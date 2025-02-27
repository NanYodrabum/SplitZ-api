const prisma = require("../configs/prisma");
const createError = require("../utils/createError");

// Create a new share item (can be used for manually adding splits)
exports.createShareItem = async (req, res, next) => {
  try {
    const { billItemId, billParticipantId, shareAmount } = req.body;
    const userId = req.user.id;

    // Verify the bill item exists
    const billItem = await prisma.billItem.findUnique({
      where: { id: parseInt(billItemId) },
      include: { bill: true }
    });

    if (!billItem) {
      return next(createError(404, 'Bill item not found'));
    }

    // Verify the participant exists
    const participant = await prisma.billParticipant.findUnique({
      where: { id: parseInt(billParticipantId) }
    });

    if (!participant) {
      return next(createError(404, 'Participant not found'));
    }

    // Create the new share item
    const shareItem = await prisma.itemSplit.create({
      data: {
        shareAmount,
        billItemId: parseInt(billItemId),
        billParticipantId: parseInt(billParticipantId),
        userId: participant.userId, // Can be null for non-registered users
        paymentStatus: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    res.status(201).json({
      message: 'Share item created successfully',
      data: shareItem
    });
  } catch (error) {
    console.error('Error creating share item:', error);
    next(createError(500, 'Failed to create share item'));
  }
};

// Get share details for a specific item
exports.getShareItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const shares = await prisma.itemSplit.findMany({
      where: { billItemId: parseInt(id) },
      include: {
        billParticipant: true,
        billItem: true
      }
    });
    
    res.status(200).json(shares);
  } catch (error) {
    console.error('Error fetching share items:', error);
    next(createError(500, 'Failed to fetch share items'));
  }
};

// Update a share item (used for marking as paid/pending)
exports.updateShareItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { paymentStatus } = req.body;
    const userId = req.user.id;

    // Verify the share item exists
    const shareItem = await prisma.itemSplit.findUnique({
      where: { id: parseInt(id) },
      include: {
        billItem: {
          include: { bill: true }
        },
        billParticipant: true
      }
    });

    if (!shareItem) {
      return next(createError(404, 'Share item not found'));
    }

    // Only allow updating if user is the bill creator or the participant who owes
    const isBillCreator = shareItem.billItem.bill.userId === userId;
    const isParticipant = shareItem.billParticipant.userId === userId;

    if (!isBillCreator && !isParticipant) {
      return next(createError(403, 'You do not have permission to update this share item'));
    }

    // Update the share item status
    const updatedShareItem = await prisma.itemSplit.update({
      where: { id: parseInt(id) },
      data: { 
        paymentStatus,
        updatedAt: new Date()
      }
    });

    res.status(200).json({
      message: 'Share item updated successfully',
      data: updatedShareItem
    });
  } catch (error) {
    console.error('Error updating share item:', error);
    next(createError(500, 'Failed to update share item'));
  }
};

// Delete a share item
exports.deleteShareItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Verify the share item exists
    const shareItem = await prisma.itemSplit.findUnique({
      where: { id: parseInt(id) },
      include: {
        billItem: {
          include: { bill: true }
        }
      }
    });

    if (!shareItem) {
      return next(createError(404, 'Share item not found'));
    }

    // Only allow deletion if user is the bill creator
    const isBillCreator = shareItem.billItem.bill.userId === userId;

    if (!isBillCreator) {
      return next(createError(403, 'Only the bill creator can delete share items'));
    }

    // Delete the share item
    await prisma.itemSplit.delete({
      where: { id: parseInt(id) }
    });

    res.status(200).json({
      message: 'Share item deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting share item:', error);
    next(createError(500, 'Failed to delete share item'));
  }
};

// exports.createShareItem = async (req, res, next) => {
//   try {
//     const { itemId, participantIds } = req.body;

//     if (!itemId || !participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
//       return createError(400, "Item ID and participant IDs are required");
//     }

//     // Get the bill item
//     const billItem = await prisma.billItem.findUnique({
//       where: { id: parseInt(itemId) }
//     });

//     if (!billItem) {
//       return createError(404, "Bill item not found");
//     }

//     // Calculate share amount
//     const shareAmount = billItem.totalAmount / participantIds.length;

//     // Create shares in transaction
//     await prisma.$transaction(async (tx) => {
//       // Delete any existing shares for this item
//       await tx.itemSplit.deleteMany({
//         where: { billItemId: parseInt(itemId) }
//       });

//       // Create new shares
//       await Promise.all(participantIds.map(participantId => {
//         return tx.itemSplit.create({
//           data: {
//             billItemId: parseInt(itemId),
//             billParticipantId: parseInt(participantId),
//             shareAmount,
//             paymentStatus: "pending"
//           }
//         });
//       }));
//     });

//     res.json({
//       message: "Item shares created successfully"
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// exports.getShareItem = async (req, res, next) => {
//   try {
//     const { id } = req.params;
    
//     const shares = await prisma.itemSplit.findMany({
//       where: { billItemId: parseInt(id) },
//       include: {
//         billItem: true,
//         billParticipant: true
//       }
//     });

//     res.json({
//       message: "Item shares retrieved successfully",
//       data: shares
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// exports.updateShareItem = async (req, res, next) => {
//   try {
//     const { id } = req.params;
//     const { paymentStatus } = req.body;

//     if (!paymentStatus || !['pending', 'completed'].includes(paymentStatus)) {
//       return createError(400, "Valid payment status is required");
//     }

//     const updatedShare = await prisma.itemSplit.update({
//       where: { id: parseInt(id) },
//       data: {
//         paymentStatus,
//         updatedAt: new Date()
//       }
//     });

//     res.json({
//       message: "Item share updated successfully",
//       data: updatedShare
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// exports.deleteShareItem = async (req, res, next) => {
//   try {
//     const { id } = req.params;

//     await prisma.itemSplit.delete({
//       where: { id: parseInt(id) }
//     });

//     res.json({
//       message: "Item share deleted successfully"
//     });
//   } catch (error) {
//     next(error);
//   }
// };