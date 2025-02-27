const prisma = require('../configs/prisma');
const createError = require('../utils/createError');

// exports.createBill = async (req, res, next) => {
//   try {
//     const { name, description, category, totalAmount, date, participants, items } = req.body;
//     const userId = req.user.id; // Get logged in user's ID from JWT

//     console.log('Creating bill with data:', { name, category, totalAmount, participants: participants.length, items: items.length });

//     // Start a transaction to ensure all database operations succeed or fail together
//     const result = await prisma.$transaction(async (tx) => {
//       // 1. Create the bill
//       const bill = await tx.bill.create({
//         data: {
//           name,
//           description,
//           category,
//           totalAmount,
//           userId,
//           createdAt: date ? new Date(date) : new Date(),
//           updatedAt: new Date()
//         }
//       });

//       console.log('Bill created:', bill.id);

//       // 2. Create bill participants and build a mapping of frontend IDs to database IDs
//       const participantMap = new Map(); 
      
//       for (const participant of participants) {
//         const billParticipant = await tx.billParticipant.create({
//           data: {
//             name: participant.name,
//             userId: participant.userId, 
//             billId: bill.id,
//             isCreator: participant.isCreator || false
//           }
//         });
        
//         console.log(`Participant created: ${billParticipant.id} for frontend ID ${participant.id}`);
        
//         // Store the mapping between frontend ID and database ID
//         participantMap.set(participant.id, billParticipant.id);
//       }

//       // 3. Create bill items and their splits
//       for (const item of items) {
//         const billItem = await tx.billItem.create({
//           data: {
//             billId: bill.id,
//             name: item.name,
//             basePrice: item.basePrice,
//             taxPercent: item.taxPercent || 0,
//             taxAmount: item.taxAmount || 0,
//             servicePercent: item.servicePercent || 0,
//             serviceAmount: item.serviceAmount || 0,
//             totalAmount: item.totalAmount,
//             createdAt: new Date(),
//             updatedAt: new Date()
//           }
//         });

//         console.log(`Bill item created: ${billItem.id}`);

//         // 4. Create item splits for each participant
//         if (item.splitWith && Array.isArray(item.splitWith)) {
//           for (const participantId of item.splitWith) {
//             // Find the participant by frontend ID
//             const participant = participants.find(p => p.id === participantId);
            
//             if (!participant) {
//               console.error(`Participant with ID ${participantId} not found in the provided participant list`);
//               continue;
//             }
            
//             // Get the database ID of the participant
//             const billParticipantId = participantMap.get(participantId);
            
//             if (!billParticipantId) {
//               console.error(`Mapping for participant ID ${participantId} not found`);
//               continue;
//             }
            
//             // Calculate share amount based on even split
//             const shareAmount = Math.round(item.totalAmount / item.splitWith.length);
            
//             // Create the ItemSplit record
//             const itemSplit = await tx.itemSplit.create({
//               data: {
//                 shareAmount,
//                 userId: participant.userId, // This can be null for non-registered users
//                 billParticipantId: billParticipantId,
//                 billItemId: billItem.id,
//                 paymentStatus: participant.isCreator ? 'completed' : 'pending',
//                 createdAt: new Date(),
//                 updatedAt: new Date()
//               }
//             });
            
//             console.log(`Item split created: ${itemSplit.id} for participant ${billParticipantId}`);
//           }
//         } else {
//           console.error('Item is missing splitWith array or it is not an array:', item);
//         }
//       }

//       return bill;
//     });

//     // Return success response
//     res.status(201).json({
//       message: 'Bill created successfully',
//       billId: result.id
//     });
//   } catch (error) {
//     console.error('Error creating bill:', error);
//     next(createError(500, error.message || 'Failed to create bill'));
//   }
// };

// Fetch all bills for a user

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
// exports.getSingleBill = async (req, res, next) => {
//   try {
//     // Log the raw parameters
//     console.log("getSingleBill - Raw params:", req.params);
    
//     const { id } = req.params;
//     const userId = req.user.id;
    
//     // Check if id exists
//     if (id === undefined || id === null) {
//       console.log("Bill ID is missing in request params");
//       return next(createError(400, 'Bill ID is required'));
//     }
    
//     console.log(`Attempting to find bill with ID: ${id}, type: ${typeof id}`);
    
//     // Convert ID to number (Prisma expects this format)
//     const billId = parseInt(id, 10);
    
//     if (isNaN(billId)) {
//       console.log(`Invalid ID format: ${id} converts to NaN`);
//       return next(createError(400, 'Invalid bill ID format - must be a number'));
//     }
    
//     console.log(`Converted bill ID: ${billId}, type: ${typeof billId}`);
    
//     // Simple Prisma query without findUnique or findFirst
//     // This uses the prisma.$queryRaw approach which is more flexible
//     const bills = await prisma.bill.findMany({
//       where: {
//         id: billId
//       },
//       include: {
//         user: {
//           select: {
//             id: true,
//             name: true,
//             email: true
//           }
//         },
//         participants: true,
//         items: {
//           include: {
//             splits: {
//               include: {
//                 billParticipant: true
//               }
//             }
//           }
//         }
//       },
//       take: 1
//     });
    
//     if (!bills || bills.length === 0) {
//       console.log(`No bill found with ID: ${billId}`);
//       return next(createError(404, 'Bill not found'));
//     }
    
//     const bill = bills[0];
//     console.log(`Found bill: ${bill.id}, Name: ${bill.name}`);
    
//     // Check if user has access to this bill
//     const isCreator = bill.userId === userId;
//     const isParticipant = bill.participants.some(p => p.userId === userId);
    
//     if (!isCreator && !isParticipant) {
//       return next(createError(403, 'You do not have access to this bill'));
//     }
    
//     // Format the response to include creator info
//     const formattedBill = {
//       ...bill,
//       creator: bill.user ? { 
//         id: bill.user.id,
//         name: bill.user.name,
//         email: bill.user.email
//       } : { 
//         id: bill.userId,
//         name: "Unknown" 
//       }
//     };
    
//     // Remove the raw user object to avoid duplication
//     delete formattedBill.user;
    
//     res.status(200).json(formattedBill);
//   } catch (error) {
//     console.error('Error fetching bill:', error);
//     next(createError(500, 'Failed to fetch bill details'));
//   }
// };

// In controllers/bills-controller.js

// In controllers/bills-controller.js

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
    const isParticipant = bill.participants.some(p => p.userId === userId);
    
    if (!isCreator && !isParticipant) {
      return next(createError(403, 'You do not have access to this bill'));
    }

    // Format items with split information
    const formattedItems = bill.items.map(item => {
      // Get unique participant names for this item
      const participantNames = item.splits.map(split => split.billParticipant.name);
      
      return {
        id: item.id,
        name: item.name,
        basePrice: item.basePrice,
        taxPercent: item.taxPercent,
        taxAmount: item.taxAmount,
        servicePercent: item.servicePercent,
        serviceAmount: item.serviceAmount,
        totalAmount: item.totalAmount,
        splitBetween: participantNames.join(', '), // Add split between information
        splits: item.splits.map(split => ({
          id: split.id,
          shareAmount: split.shareAmount,
          paymentStatus: split.paymentStatus,
          participant: {
            id: split.billParticipant.id,
            name: split.billParticipant.name
          }
        }))
      };
    });

    // Calculate participant totals
    const formattedParticipants = bill.participants.map(participant => {
      let totalAmount = 0;
      let pendingAmount = 0;
      let paidAmount = 0;

      // Calculate totals from all splits for this participant
      bill.items.forEach(item => {
        item.splits.forEach(split => {
          if (split.billParticipant.id === participant.id) {
            totalAmount += split.shareAmount;
            if (split.paymentStatus === 'pending') {
              pendingAmount += split.shareAmount;
            } else {
              paidAmount += split.shareAmount;
            }
          }
        });
      });

      return {
        id: participant.id,
        name: participant.name,
        totalAmount,
        pendingAmount,
        paidAmount,
        isCreator: participant.isCreator
      };
    });

    // Format the final response
    const response = {
      id: bill.id,
      name: bill.name,
      description: bill.description,
      category: bill.category,
      totalAmount: bill.totalAmount,
      createdAt: bill.createdAt,
      updatedAt: bill.updatedAt,
      creator: {
        id: bill.user.id,
        name: bill.user.name,
        email: bill.user.email
      },
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
    const { name, description, category } = req.body;
    
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
    const bills = await prisma.bill.findMany({
      where: { id: billId },
      take: 1
    });
    
    if (!bills || bills.length === 0) {
      return next(createError(404, 'Bill not found'));
    }
    
    const bill = bills[0];
    
    if (bill.userId !== userId) {
      return next(createError(403, 'Only the bill creator can edit it'));
    }
    
    // Update basic bill details
    const updatedBill = await prisma.bill.updateMany({
      where: { id: billId },
      data: {
        name,
        description,
        category,
        updatedAt: new Date()
      }
    });
    
    res.status(200).json({
      message: 'Bill updated successfully',
      data: {
        id: billId,
        name,
        description,
        category
      }
    });
  } catch (error) {
    console.error('Error updating bill:', error);
    next(createError(500, 'Failed to update bill'));
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
