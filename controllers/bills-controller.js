const prisma = require("../configs/prisma");

exports.createBill = async (req, res, next) => {
  try {
    const { 
      name, 
      description, 
      category, 
      totalAmount, 
      participants, 
      items 
    } = req.body;
    
    const userId = req.user.id; // Assuming you're using authCheck middleware
    
    // Create the bill with participants and items in a transaction
    const bill = await prisma.$transaction(async (tx) => {
      // Create the bill
      const newBill = await tx.bill.create({
        data: {
          name,
          description,
          category: category || "etc",
          totalAmount,
          userId
        }
      });
      
      // Create participants
      if (participants && participants.length > 0) {
        await Promise.all(participants.map(participant => {
          return tx.billParticipant.create({
            data: {
              name: participant.name,
              userId: participant.userId,
              billId: newBill.id,
              isCreator: participant.isCreator || false
            }
          });
        }));
      }
      
      // Create items
      if (items && items.length > 0) {
        await Promise.all(items.map(item => {
          return tx.billItem.create({
            data: {
              billId: newBill.id,
              name: item.name,
              basePrice: item.basePrice,
              taxPercent: item.taxPercent || 0,
              taxAmount: (item.basePrice * item.taxPercent / 100) || 0,
              servicePercent: item.servicePercent || 0,
              serviceAmount: (item.basePrice * item.servicePercent / 100) || 0,
              totalAmount: item.totalAmount
            }
          });
        }));
      }
      
      return newBill;
    });
    
    res.status(201).json({ 
      message: "Bill created successfully", 
      data: bill 
    });
  } catch (error) {
    next(error);
  }
};

exports.getAllBill = async (req, res, next) => {
  try {
    const userId = req.user.id; // Assuming you're using authCheck middleware
    
    const bills = await prisma.bill.findMany({
      where: { userId },
      include: {
        participants: true,
        items: true
      },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json({ 
      message: "Bills retrieved successfully", 
      data: bills 
    });
  } catch (error) {
    next(error);
  }
};

exports.getSingleBill = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if id is provided
    if (!id) {
      return res.status(400).json({ message: 'Bill ID is required' });
    }
    
    // Parse id to integer since Prisma expects an integer for Int fields
    const billId = parseInt(id, 10);
    
    // Check if parsed id is a valid number
    if (isNaN(billId)) {
      return res.status(400).json({ message: 'Invalid bill ID format' });
    }
    
    // Now we can safely query with a valid ID
    const bill = await prisma.bill.findUnique({
      where: {
        id: billId
      },
      include: {
        participants: true,
        items: {
          include: {
            splits: {
              include: {
                billParticipant: true
              }
            }
          }
        }
      }
    });

    if (!bill) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    return res.status(200).json(bill);
  } catch (error) {
    console.error('Error retrieving bill:', error);
    return res.status(500).json({ 
      message: 'Failed to retrieve bill',
      error: error.message 
    });
  }
};

exports.editBill = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, category, totalAmount } = req.body;
    
    const bill = await prisma.bill.update({
      where: { id: parseInt(id) },
      data: {
        name,
        description,
        category,
        totalAmount,
        updatedAt: new Date()
      }
    });
    
    res.json({ 
      message: "Bill updated successfully", 
      data: bill 
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteBill = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Delete all related records in a transaction
    await prisma.$transaction(async (tx) => {
      // First delete all splits for this bill's items
      await tx.itemSplit.deleteMany({
        where: {
          billItem: {
            billId: parseInt(id)
          }
        }
      });
      
      // Then delete all items
      await tx.billItem.deleteMany({
        where: { billId: parseInt(id) }
      });
      
      // Then delete all participants
      await tx.billParticipant.deleteMany({
        where: { billId: parseInt(id) }
      });
      
      // Finally delete the bill
      await tx.bill.delete({
        where: { id: parseInt(id) }
      });
    });
    
    res.json({ message: "Bill deleted successfully" });
  } catch (error) {
    next(error);
  }
};