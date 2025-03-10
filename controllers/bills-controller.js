const prisma = require('../configs/prisma');
const createError = require('../utils/createError');

exports.createBill = async (req, res, next) => {
  try {
    const { name, description, category, totalAmount, date, participants, items } = req.body;
    const userId = req.user.id;

    const result = await prisma.$transaction(async (tx) => {
      // Create the bill
      const bill = await tx.bill.create({
        data: {
          name,
          description,
          category,
          totalAmount,
          userId,
          createdAt: date ? new Date(date) : new Date(),
          updatedAt: new Date()
        }
      });

      // Create participants with tracking of their total amounts
      const participantMap = new Map();
      const participantTotals = new Map();
      
      for (const participant of participants) {
        const billParticipant = await tx.billParticipant.create({
          data: {
            name: participant.name,
            userId: participant.userId,
            billId: bill.id,
            isCreator: participant.userId === userId
          }
        });
        
        participantMap.set(participant.id, billParticipant.id);
        participantTotals.set(billParticipant.id, 0);
      }

      // Create items and their splits
      for (const item of items) {
        const billItem = await tx.billItem.create({
          data: {
            billId: bill.id,
            name: item.name,
            basePrice: item.basePrice,
            taxPercent: item.taxPercent || 0,
            taxAmount: item.taxAmount || 0,
            servicePercent: item.servicePercent || 0,
            serviceAmount: item.serviceAmount || 0,
            totalAmount: item.totalAmount
          }
        });

        // Handle splits
        if (item.splitWith && Array.isArray(item.splitWith)) {
          const shareAmount = item.totalAmount / item.splitWith.length;
          
          for (const participantId of item.splitWith) {
            const billParticipantId = participantMap.get(participantId);
            
            if (billParticipantId) {
              // Create split
              await tx.itemSplit.create({
                data: {
                  shareAmount,
                  billParticipantId,
                  billItemId: billItem.id,
                  paymentStatus: 'pending',
                  userId: participants.find(p => p.id === participantId)?.userId || null
                }
              });

              // Update participant total
              const currentTotal = participantTotals.get(billParticipantId) || 0;
              participantTotals.set(billParticipantId, currentTotal + shareAmount);
            }
          }
        }
      }

      return bill;
    });

    res.status(201).json({
      message: 'Bill created successfully',
      billId: result.id
    });
  } catch (error) {
    console.error('Error creating bill:', error);
    next(createError(500, error.message || 'Failed to create bill'));
  }
};

exports.getAllBill = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // Find bills where user is either the creator or a participant
    const bills = await prisma.bill.findMany({
      where: {
        OR: [
          { userId },
          {
            participants: {
              some: {
                userId
              }
            }
          }
        ]
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        participants: true,
        items: true
      }
    });
    
    // Format the response to include creator info
    const formattedBills = bills.map(bill => {
      const formattedBill = {
        ...bill,
        creator: bill.user ? {
          id: bill.user.id,
          name: bill.user.name
        } : {
          id: bill.userId,
          name: "Unknown"
        }
      };
      
      // Remove raw user object to avoid duplication
      delete formattedBill.user;
      
      return formattedBill;
    });
    
    res.status(200).json({
      message: 'Bills fetched successfully',
      data: formattedBills
    });
  } catch (error) {
    console.error('Error fetching bills:', error);
    next(createError(500, 'Failed to fetch bills'));
  }
};

// Get single bill with all details
exports.getSingleBill = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    if (!id) {
      return next(createError(400, 'Bill ID is required'));
    }
    
    const billId = parseInt(id, 10);
    
    if (isNaN(billId)) {
      return next(createError(400, 'Invalid bill ID format'));
    }

    // Get bill with all related data
    const bill = await prisma.bill.findUnique({
      where: {
        id: billId
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        participants: {
          include: {
            itemsSplit: true // Include splits for calculating total amount
          }
        },
        items: {
          include: {
            splits: {
              include: {
                billParticipant: {
                  select: {
                    id: true,
                    name: true,
                    userId: true,
                    isCreator: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!bill) {
      return next(createError(404, 'Bill not found'));
    }

    // Check user access
    const isCreator = bill.userId === userId;
    const isParticipant = bill.participants && bill.participants.some(p => p && p.userId === userId);
    
    if (!isCreator && !isParticipant) {
      return next(createError(403, 'You do not have access to this bill'));
    }

    // Format items with split information
    const formattedItems = (bill.items || []).map(item => {
      if (!item) return null;
      
      // Get unique participant names for this item
      const participantNames = (item.splits || [])
        .filter(split => split && split.billParticipant)
        .map(split => split.billParticipant.name || 'Unknown');
      
      return {
        id: item.id,
        name: item.name || 'Unnamed Item',
        basePrice: item.basePrice || 0,
        taxPercent: item.taxPercent || 0,
        taxAmount: item.taxAmount || 0,
        servicePercent: item.servicePercent || 0,
        serviceAmount: item.serviceAmount || 0,
        totalAmount: item.totalAmount || 0,
        splitBetween: participantNames.join(', '), // Add split between information
        splits: (item.splits || [])
          .filter(split => split && split.billParticipant)
          .map(split => ({
            id: split.id,
            shareAmount: split.shareAmount || 0,
            paymentStatus: split.paymentStatus || 'pending',
            participant: {
              id: split.billParticipant.id,
              name: split.billParticipant.name || 'Unknown'
            }
          }))
      };
    }).filter(Boolean);

    // Calculate participant totals
    const formattedParticipants = (bill.participants || []).map(participant => {
      if (!participant) return null;
      
      let totalAmount = 0;
      let pendingAmount = 0;
      let paidAmount = 0;

      // Calculate totals from all splits for this participant
      (bill.items || []).forEach(item => {
        if (!item || !item.splits) return;
        
        item.splits.forEach(split => {
          if (!split || !split.billParticipant) return;
          
          if (split.billParticipant.id === participant.id) {
            totalAmount += split.shareAmount || 0;
            if (split.paymentStatus === 'pending') {
              pendingAmount += split.shareAmount || 0;
            } else {
              paidAmount += split.shareAmount || 0;
            }
          }
        });
      });

      return {
        id: participant.id,
        name: participant.name || 'Unknown Participant',
        totalAmount,
        pendingAmount,
        paidAmount,
        isCreator: participant.isCreator || false
      };
    }).filter(Boolean);

    // Ensure user object exists
    const creatorInfo = bill.user ? {
      id: bill.user.id,
      name: bill.user.name || 'Unknown',
      email: bill.user.email || ''
    } : {
      id: bill.userId,
      name: 'Unknown',
      email: ''
    };

    // Format the final response
    const response = {
      id: bill.id,
      name: bill.name || 'Unnamed Bill',
      description: bill.description || '',
      category: bill.category || 'other',
      totalAmount: bill.totalAmount || 0,
      createdAt: bill.createdAt,
      updatedAt: bill.updatedAt,
      creator: creatorInfo,
      items: formattedItems,
      participants: formattedParticipants
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Error fetching bill:', error);
    next(createError(500, 'Failed to fetch bill details'));
  }
};

// Update a bill
exports.editBill = async (req, res, next) => {
  try {
    console.log("editBill - Raw params:", req.params);
    
    const { id } = req.params;
    const userId = req.user.id;
    const { 
      name, 
      description, 
      category, 
      date, 
      totalAmount, 
      participants, 
      items 
    } = req.body;
    
    // Check if id exists
    if (id === undefined || id === null) {
      console.log("Bill ID is missing in request params");
      return next(createError(400, 'Bill ID is required'));
    }
    
    // Convert ID to number (Prisma expects this format)
    const billId = parseInt(id, 10);
    
    if (isNaN(billId)) {
      console.log(`Invalid ID format: ${id} converts to NaN`);
      return next(createError(400, 'Invalid bill ID format - must be a number'));
    }
    
    console.log(`Looking for bill with ID: ${billId}`);
    
    // First check if bill exists and user is the creator
    const bill = await prisma.bill.findUnique({
      where: { id: billId },
      include: {
        participants: true,
        items: {
          include: {
            splits: true
          }
        }
      }
    });
    
    if (!bill) {
      return next(createError(404, 'Bill not found'));
    }
    
    if (bill.userId !== userId) {
      return next(createError(403, 'Only the bill creator can edit it'));
    }

    // Use transaction to ensure all updates are atomic
    const result = await prisma.$transaction(async (tx) => {
      // 1. Update basic bill details
      const updatedBill = await tx.bill.update({
        where: { id: billId },
        data: {
          name,
          description,
          category,
          totalAmount,
          updatedAt: new Date()
        }
      });

      // Maps for keeping track of existing vs new entities
      const existingParticipants = new Map(bill.participants.map(p => [p.id, p]));
      const newParticipantMap = new Map(); // Will map frontend IDs to DB IDs
      const existingItems = new Map(bill.items.map(i => [i.id, i]));

      // 2. Handle participants
      if (participants && Array.isArray(participants)) {
        for (const participant of participants) {
          if (existingParticipants.has(participant.id)) {
            // Update existing participant
            await tx.billParticipant.update({
              where: { id: participant.id },
              data: {
                name: participant.name,
                userId: participant.userId,
                isCreator: participant.isCreator
              }
            });
            newParticipantMap.set(participant.id, participant.id); // Map to the same ID
          } else {
            // Create new participant
            const newParticipant = await tx.billParticipant.create({
              data: {
                name: participant.name,
                userId: participant.userId,
                billId: billId,
                isCreator: participant.isCreator
              }
            });
            newParticipantMap.set(participant.id, newParticipant.id);
          }
        }

        // Delete participants that weren't included in the update
        const updatedParticipantIds = new Set(participants.map(p => p.id));
        for (const [id, _] of existingParticipants) {
          if (!updatedParticipantIds.has(id)) {
            // Find all splits for this participant and delete them first
            await tx.itemSplit.deleteMany({
              where: {
                billParticipantId: id
              }
            });
            // Then delete the participant
            await tx.billParticipant.delete({
              where: { id }
            });
          }
        }
      }

      // 3. Handle items and their splits
      if (items && Array.isArray(items)) {
        for (const item of items) {
          if (existingItems.has(item.id)) {
            // Update existing item
            await tx.billItem.update({
              where: { id: item.id },
              data: {
                name: item.name,
                basePrice: item.basePrice,
                taxPercent: item.taxPercent || 0,
                taxAmount: item.taxAmount || 0,
                servicePercent: item.servicePercent || 0,
                serviceAmount: item.serviceAmount || 0,
                totalAmount: item.totalAmount,
                updatedAt: new Date()
              }
            });

            // Delete existing splits for this item to replace with new ones
            await tx.itemSplit.deleteMany({
              where: {
                billItemId: item.id
              }
            });
          } else {
            // Create new item
            const newItem = await tx.billItem.create({
              data: {
                billId,
                name: item.name,
                basePrice: item.basePrice,
                taxPercent: item.taxPercent || 0,
                taxAmount: item.taxAmount || 0,
                servicePercent: item.servicePercent || 0,
                serviceAmount: item.serviceAmount || 0,
                totalAmount: item.totalAmount
              }
            });
            item.id = newItem.id; // Update item id for splits processing
          }

          // Create new splits for this item
          if (item.splitWith && Array.isArray(item.splitWith)) {
            const shareAmount = item.totalAmount / item.splitWith.length;
            
            for (const participantId of item.splitWith) {
              // Use the mapping to get the correct DB participantId
              const dbParticipantId = newParticipantMap.get(participantId);
              
              if (dbParticipantId) {
                // Get user ID if available
                const participant = participants.find(p => p.id === participantId);
                const userId = participant?.userId || null;
                
                await tx.itemSplit.create({
                  data: {
                    shareAmount,
                    billParticipantId: dbParticipantId,
                    billItemId: item.id,
                    paymentStatus: 'pending',
                    userId
                  }
                });
              }
            }
          }
        }

        // Delete items that weren't included in the update
        const updatedItemIds = new Set(items.filter(i => existingItems.has(i.id)).map(i => i.id));
        for (const [id, _] of existingItems) {
          if (!updatedItemIds.has(id)) {
            // Delete all splits for this item first
            await tx.itemSplit.deleteMany({
              where: {
                billItemId: id
              }
            });
            // Then delete the item
            await tx.billItem.delete({
              where: { id }
            });
          }
        }
      }

      return updatedBill;
    });
    
    res.status(200).json({
      message: 'Bill updated successfully',
      data: {
        id: billId,
        name,
        description,
        category,
        totalAmount
      }
    });
  } catch (error) {
    console.error('Error updating bill:', error);
    next(createError(500, 'Failed to update bill: ' + error.message));
  }
};

// Delete a bill
exports.deleteBill = async (req, res, next) => {
  try {
    console.log("deleteBill - Raw params:", req.params);
    
    const { id } = req.params;
    const userId = req.user.id;
    
    // Check if id exists
    if (id === undefined || id === null) {
      console.log("Bill ID is missing in request params");
      return next(createError(400, 'Bill ID is required'));
    }
    
    // Convert ID to number (Prisma expects this format)
    const billId = parseInt(id, 10);
    
    if (isNaN(billId)) {
      console.log(`Invalid ID format: ${id} converts to NaN`);
      return next(createError(400, 'Invalid bill ID format - must be a number'));
    }
    
    console.log(`Looking for bill with ID: ${billId}`);
    
    // Check if bill exists and user is the creator
    const bills = await prisma.bill.findMany({
      where: { id: billId },
      take: 1
    });
    
    if (!bills || bills.length === 0) {
      return next(createError(404, 'Bill not found'));
    }
    
    const bill = bills[0];
    
    if (bill.userId !== userId) {
      return next(createError(403, 'Only the bill creator can delete it'));
    }
    
    try {
      // Delete all related records in the correct order
      await prisma.$transaction(async (tx) => {
        // 1. First delete all item splits
        await tx.itemSplit.deleteMany({
          where: {
            billItem: {
              billId: billId
            }
          }
        });
        
        // 2. Delete all bill items
        await tx.billItem.deleteMany({
          where: {
            billId: billId
          }
        });
        
        // 3. Delete all bill participants
        await tx.billParticipant.deleteMany({
          where: {
            billId: billId
          }
        });
        
        // 4. Finally delete the bill
        await tx.bill.deleteMany({
          where: {
            id: billId
          }
        });
      });
      
      res.status(200).json({
        message: 'Bill deleted successfully'
      });
    } catch (deleteError) {
      console.error('Error in delete transaction:', deleteError);
      throw new Error('Failed to delete bill and related records');
    }
  } catch (error) {
    console.error('Error deleting bill:', error);
    next(createError(500, 'Failed to delete bill'));
  }
};
