const prisma = require('../configs/prisma');
const createError = require('../utils/createError');

// Get summary of all splits for the logged-in user
exports.splitSummary = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Find all bills where the user is either the creator or a participant
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

    // Calculate how much the user is owed (as bill creator)
    let totalOwedToUser = 0;
    let totalUserOwes = 0;
    
    // People who owe the user
    const peopleWhoOweUser = [];
    // People the user owes
    const peopleUserOwes = [];

    for (const bill of bills) {
      const isCreator = bill.userId === userId;
      
      for (const item of bill.items) {
        for (const split of item.splits) {
          const splitParticipantId = split.billParticipant.userId;
          const participantName = split.billParticipant.name;
          
          // Skip if the split is already completed
          if (split.paymentStatus === 'completed') {
            continue;
          }
          
          if (isCreator && splitParticipantId !== userId) {
            // Creator is owed money by this participant
            totalOwedToUser += split.shareAmount;
            
            // Add to the list of people who owe the user
            const existingPerson = peopleWhoOweUser.find(p => p.userId === splitParticipantId);
            if (existingPerson) {
              existingPerson.amount += split.shareAmount;
            } else {
              peopleWhoOweUser.push({
                userId: splitParticipantId,
                name: participantName,
                amount: split.shareAmount
              });
            }
          } else if (!isCreator && splitParticipantId === userId) {
            // User owes money to the bill creator
            totalUserOwes += split.shareAmount;
            
            // Add to the list of people the user owes
            const existingPerson = peopleUserOwes.find(p => p.userId === bill.userId);
            if (existingPerson) {
              existingPerson.amount += split.shareAmount;
            } else {
              // Find the creator's name
              const creator = bill.participants.find(p => p.userId === bill.userId);
              peopleUserOwes.push({
                userId: bill.userId,
                name: creator ? creator.name : 'Unknown',
                amount: split.shareAmount
              });
            }
          }
        }
      }
    }

    // Calculate net balance
    const netBalance = totalOwedToUser - totalUserOwes;

    res.status(200).json({
      totalOwedToUser,
      totalUserOwes,
      netBalance,
      peopleWhoOweUser: peopleWhoOweUser.sort((a, b) => b.amount - a.amount), // Sort by amount in descending order
      peopleUserOwes: peopleUserOwes.sort((a, b) => b.amount - a.amount)
    });
  } catch (error) {
    console.error('Error calculating split summary:', error);
    next(createError(500, 'Failed to calculate split summary'));
  }
};

// Get detailed breakdown of bills between the current user and another user
exports.userSplitDetails = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { otherUserId } = req.params;
    
    if (!otherUserId) {
      return next(createError(400, 'Other user ID is required'));
    }

    // Find all bills where both users are participants
    const bills = await prisma.bill.findMany({
      where: {
        OR: [
          {
            userId,
            participants: {
              some: {
                userId: parseInt(otherUserId)
              }
            }
          },
          {
            userId: parseInt(otherUserId),
            participants: {
              some: {
                userId
              }
            }
          }
        ]
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

    // Calculate detailed breakdown
    const breakdown = bills.map(bill => {
      // Calculate how much the other user owes the current user in this bill
      const currentUserOwed = bill.userId === userId ? 
        bill.items.reduce((total, item) => {
          return total + item.splits.reduce((itemTotal, split) => {
            if (split.billParticipant.userId === parseInt(otherUserId) && split.paymentStatus === 'pending') {
              return itemTotal + split.shareAmount;
            }
            return itemTotal;
          }, 0);
        }, 0) : 0;

      // Calculate how much the current user owes the other user in this bill
      const currentUserOwes = bill.userId === parseInt(otherUserId) ? 
        bill.items.reduce((total, item) => {
          return total + item.splits.reduce((itemTotal, split) => {
            if (split.billParticipant.userId === userId && split.paymentStatus === 'pending') {
              return itemTotal + split.shareAmount;
            }
            return itemTotal;
          }, 0);
        }, 0) : 0;

      return {
        billId: bill.id,
        billName: bill.name,
        date: bill.createdAt,
        currentUserOwed,
        currentUserOwes,
        netAmount: currentUserOwed - currentUserOwes,
        itemDetails: bill.items.map(item => {
          const relevantSplits = item.splits.filter(split => 
            split.billParticipant.userId === userId || 
            split.billParticipant.userId === parseInt(otherUserId)
          );
          
          return {
            itemId: item.id,
            itemName: item.name,
            totalAmount: item.totalAmount,
            splits: relevantSplits.map(split => ({
              splitId: split.id,
              participantId: split.billParticipant.id,
              participantName: split.billParticipant.name,
              userId: split.billParticipant.userId,
              amount: split.shareAmount,
              status: split.paymentStatus
            }))
          };
        })
      };
    });

    // Calculate totals
    const totalCurrentUserOwed = breakdown.reduce((total, bill) => total + bill.currentUserOwed, 0);
    const totalCurrentUserOwes = breakdown.reduce((total, bill) => total + bill.currentUserOwes, 0);
    const netBalance = totalCurrentUserOwed - totalCurrentUserOwes;

    res.status(200).json({
      totalCurrentUserOwed,
      totalCurrentUserOwes,
      netBalance,
      bills: breakdown
    });
  } catch (error) {
    console.error('Error fetching user split details:', error);
    next(createError(500, 'Failed to fetch user split details'));
  }
};

// Add this simple function as a fallback in case it's referenced in routes
exports.splitBySomeOtherName = async (req, res, next) => {
  try {
    res.status(200).json({
      message: 'This is a fallback function to prevent undefined errors'
    });
  } catch (error) {
    next(createError(500, error.message));
  }
};

