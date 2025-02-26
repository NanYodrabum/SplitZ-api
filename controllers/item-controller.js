// controllers/item-controller.js
const prisma = require("../configs/prisma");
const createError = require("../utils/createError");

exports.createItem = async (req, res, next) => {
    try {
        const { 
            billId, 
            name, 
            basePrice, 
            taxPercent, 
            servicePercent,
            splitWith 
        } = req.body;

        // Validate required fields
        if (!billId) {
            return createError(400, "Bill ID is required");
        }

        if (!name || !basePrice) {
            return createError(400, "Item name and base price are required");
        }
        
        // Calculate amounts
        const basePriceFloat = parseFloat(basePrice);
        const taxPercentFloat = parseFloat(taxPercent || 0);
        const servicePercentFloat = parseFloat(servicePercent || 0);
        
        const taxAmount = (basePriceFloat * taxPercentFloat) / 100;
        const serviceAmount = (basePriceFloat * servicePercentFloat) / 100;
        const totalAmount = basePriceFloat + taxAmount + serviceAmount;

        // Create item in transaction
        const newItem = await prisma.$transaction(async (tx) => {
            // Create the item
            const item = await tx.billItem.create({
                data: {
                    billId: parseInt(billId),
                    name,
                    basePrice: basePriceFloat,
                    taxPercent: taxPercentFloat,
                    taxAmount,
                    servicePercent: servicePercentFloat,
                    serviceAmount,
                    totalAmount
                }
            });

            // Create splits if provided
            if (splitWith && splitWith.length > 0) {
                const amountPerPerson = totalAmount / splitWith.length;
                
                await Promise.all(splitWith.map(participantId => {
                    return tx.itemSplit.create({
                        data: {
                            billItemId: item.id,
                            billParticipantId: parseInt(participantId),
                            shareAmount: amountPerPerson,
                            paymentStatus: "pending"
                        }
                    });
                }));
            }

            // Update bill total amount
            const bill = await tx.bill.findUnique({
                where: { id: parseInt(billId) },
                select: { totalAmount: true }
            });

            await tx.bill.update({
                where: { id: parseInt(billId) },
                data: { totalAmount: bill.totalAmount + totalAmount }
            });

            return item;
        });

        res.status(201).json({
            message: "Item created successfully",
            data: newItem
        });
    } catch (error) {
        next(error);
    }
};

exports.getItem = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        const item = await prisma.billItem.findUnique({
            where: { id: parseInt(id) },
            include: {
                splits: {
                    include: {
                        billParticipant: true
                    }
                }
            }
        });

        if (!item) {
            return createError(404, "Item not found");
        }

        res.json({
            message: "Item retrieved successfully",
            data: item
        });
    } catch (error) {
        next(error);
    }
};

exports.updateItem = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { 
            name, 
            basePrice, 
            taxPercent, 
            servicePercent,
            splitWith 
        } = req.body;

        // Get current item
        const currentItem = await prisma.billItem.findUnique({
            where: { id: parseInt(id) },
            include: { splits: true }
        });

        if (!currentItem) {
            return createError(404, "Item not found");
        }

        // Calculate new amounts
        const basePriceFloat = parseFloat(basePrice);
        const taxPercentFloat = parseFloat(taxPercent || 0);
        const servicePercentFloat = parseFloat(servicePercent || 0);
        
        const taxAmount = (basePriceFloat * taxPercentFloat) / 100;
        const serviceAmount = (basePriceFloat * servicePercentFloat) / 100;
        const totalAmount = basePriceFloat + taxAmount + serviceAmount;
        
        // Calculate difference in total to update bill total
        const amountDifference = totalAmount - currentItem.totalAmount;

        // Update in transaction
        const updatedItem = await prisma.$transaction(async (tx) => {
            // Update the item
            const item = await tx.billItem.update({
                where: { id: parseInt(id) },
                data: {
                    name,
                    basePrice: basePriceFloat,
                    taxPercent: taxPercentFloat,
                    taxAmount,
                    servicePercent: servicePercentFloat,
                    serviceAmount,
                    totalAmount,
                    updatedAt: new Date()
                }
            });

            // Update or create splits if provided
            if (splitWith && splitWith.length > 0) {
                // Delete current splits
                await tx.itemSplit.deleteMany({
                    where: { billItemId: parseInt(id) }
                });
                
                // Create new splits
                const amountPerPerson = totalAmount / splitWith.length;
                
                await Promise.all(splitWith.map(participantId => {
                    return tx.itemSplit.create({
                        data: {
                            billItemId: item.id,
                            billParticipantId: parseInt(participantId),
                            shareAmount: amountPerPerson,
                            paymentStatus: "pending"
                        }
                    });
                }));
            }

            // Update bill total amount
            if (amountDifference !== 0) {
                const bill = await tx.bill.findUnique({
                    where: { id: currentItem.billId },
                    select: { totalAmount: true }
                });

                await tx.bill.update({
                    where: { id: currentItem.billId },
                    data: { totalAmount: bill.totalAmount + amountDifference }
                });
            }

            return item;
        });

        res.json({
            message: "Item updated successfully",
            data: updatedItem
        });
    } catch (error) {
        next(error);
    }
};

exports.deleteItem = async (req, res, next) => {
    try {
        const { id } = req.params;

        // Get current item to calculate bill total update
        const currentItem = await prisma.billItem.findUnique({
            where: { id: parseInt(id) }
        });

        if (!currentItem) {
            return createError(404, "Item not found");
        }

        // Delete in transaction
        await prisma.$transaction(async (tx) => {
            // Delete splits first
            await tx.itemSplit.deleteMany({
                where: { billItemId: parseInt(id) }
            });
            
            // Delete the item
            await tx.billItem.delete({
                where: { id: parseInt(id) }
            });

            // Update bill total amount
            const bill = await tx.bill.findUnique({
                where: { id: currentItem.billId },
                select: { totalAmount: true }
            });

            await tx.bill.update({
                where: { id: currentItem.billId },
                data: { totalAmount: bill.totalAmount - currentItem.totalAmount }
            });
        });

        res.json({
            message: "Item deleted successfully"
        });
    } catch (error) {
        next(error);
    }
};