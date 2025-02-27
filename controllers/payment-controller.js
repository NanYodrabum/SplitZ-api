const prisma = require('../configs/prisma');
const createError = require('../utils/createError');


// Update payment status for multiple item splits
exports.updataPayment = async (req, res, next) => {
  try {
    const { splitIds, paymentStatus } = req.body;
    const userId = req.user.id;

    if (!splitIds || !Array.isArray(splitIds) || splitIds.length === 0) {
      return next(createError(400, 'No split IDs provided'));
    }

    if (!paymentStatus || !['pending', 'completed'].includes(paymentStatus)) {
      return next(createError(400, 'Invalid payment status'));
    }

    // Convert all IDs to integers
    const parsedSplitIds = splitIds.map(id => parseInt(id));

    // First, check if the user has permission to update these splits
    const splits = await prisma.itemSplit.findMany({
      where: {
        id: { in: parsedSplitIds }
      },
      include: {
        billItem: {
          include: {
            bill: true
          }
        },
        billParticipant: true
      }
    });

    // If not all splits were found, return an error
    if (splits.length !== parsedSplitIds.length) {
      return next(createError(404, 'Some split items were not found'));
    }

    // Check permissions for each split
    for (const split of splits) {
      const isBillCreator = split.billItem.bill.userId === userId;
      const isParticipant = split.billParticipant.userId === userId;

      if (!isBillCreator && !isParticipant) {
        return next(createError(403, 'You do not have permission to update some of these splits'));
      }
    }

    // Update all splits in a transaction
    await prisma.$transaction(async (tx) => {
      for (const id of parsedSplitIds) {
        await tx.itemSplit.update({
          where: { id },
          data: {
            paymentStatus,
            updatedAt: new Date()
          }
        });
      }
    });

    res.status(200).json({
      message: `Successfully updated ${splits.length} payment splits to ${paymentStatus}`
    });
  } catch (error) {
    console.error('Error updating payments:', error);
    next(createError(500, 'Failed to update payments'));
  }
};

// Get payment summary by bill
exports.getPaymentSummary = async (req, res, next) => {
  try {
    const { billId } = req.params;
    const userId = req.user.id;

    // Check if the bill exists and the user has access
    const bill = await prisma.bill.findUnique({
      where: { id: parseInt(billId) },
      include: {
        participants: true
      }
    });

    if (!bill) {
      return next(createError(404, 'Bill not found'));
    }

    // Check if user has access to this bill
    const isCreator = bill.userId === userId;
    const isParticipant = bill.participants.some(p => p.userId === userId);

    if (!isCreator && !isParticipant) {
      return next(createError(403, 'You do not have access to this bill'));
    }

    // Get all item splits for this bill
    const itemSplits = await prisma.itemSplit.findMany({
      where: {
        billItem: {
          billId: parseInt(billId)
        }
      },
      include: {
        billParticipant: true,
        billItem: true
      }
    });

    // Group the splits by participant
    const participantSummary = {};

    for (const split of itemSplits) {
      const participantId = split.billParticipantId;
      const participantName = split.billParticipant.name;

      if (!participantSummary[participantId]) {
        participantSummary[participantId] = {
          participant: {
            id: participantId,
            name: participantName,
            userId: split.billParticipant.userId,
            isCreator: split.billParticipant.isCreator
          },
          totalAmount: 0,
          paidAmount: 0,
          pendingAmount: 0,
          splits: []
        };
      }

      participantSummary[participantId].splits.push({
        id: split.id,
        itemName: split.billItem.name,
        amount: split.shareAmount,
        status: split.paymentStatus
      });

      participantSummary[participantId].totalAmount += split.shareAmount;

      if (split.paymentStatus === 'completed') {
        participantSummary[participantId].paidAmount += split.shareAmount;
      } else {
        participantSummary[participantId].pendingAmount += split.shareAmount;
      }
    }

    res.status(200).json({
      billId: bill.id,
      billName: bill.name,
      totalAmount: bill.totalAmount,
      participants: Object.values(participantSummary)
    });
  } catch (error) {
    console.error('Error fetching payment summary:', error);
    next(createError(500, 'Failed to fetch payment summary'));
  }
};
