const prisma = require("../configs/prisma");
const createError = require("../utils/createError");

exports.createShareItem = async (req, res, next) => {
  try {
    const { itemId, participantIds } = req.body;

    if (!itemId || !participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
      return createError(400, "Item ID and participant IDs are required");
    }

    // Get the bill item
    const billItem = await prisma.billItem.findUnique({
      where: { id: parseInt(itemId) }
    });

    if (!billItem) {
      return createError(404, "Bill item not found");
    }

    // Calculate share amount
    const shareAmount = billItem.totalAmount / participantIds.length;

    // Create shares in transaction
    await prisma.$transaction(async (tx) => {
      // Delete any existing shares for this item
      await tx.itemSplit.deleteMany({
        where: { billItemId: parseInt(itemId) }
      });

      // Create new shares
      await Promise.all(participantIds.map(participantId => {
        return tx.itemSplit.create({
          data: {
            billItemId: parseInt(itemId),
            billParticipantId: parseInt(participantId),
            shareAmount,
            paymentStatus: "pending"
          }
        });
      }));
    });

    res.json({
      message: "Item shares created successfully"
    });
  } catch (error) {
    next(error);
  }
};

exports.getShareItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const shares = await prisma.itemSplit.findMany({
      where: { billItemId: parseInt(id) },
      include: {
        billItem: true,
        billParticipant: true
      }
    });

    res.json({
      message: "Item shares retrieved successfully",
      data: shares
    });
  } catch (error) {
    next(error);
  }
};

exports.updateShareItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { paymentStatus } = req.body;

    if (!paymentStatus || !['pending', 'completed'].includes(paymentStatus)) {
      return createError(400, "Valid payment status is required");
    }

    const updatedShare = await prisma.itemSplit.update({
      where: { id: parseInt(id) },
      data: {
        paymentStatus,
        updatedAt: new Date()
      }
    });

    res.json({
      message: "Item share updated successfully",
      data: updatedShare
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteShareItem = async (req, res, next) => {
  try {
    const { id } = req.params;

    await prisma.itemSplit.delete({
      where: { id: parseInt(id) }
    });

    res.json({
      message: "Item share deleted successfully"
    });
  } catch (error) {
    next(error);
  }
};