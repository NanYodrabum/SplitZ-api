const prisma = require("../configs/prisma");

exports.updataPayment = async (req, res, next) => {
  try {
    res.json({ message: "Update Payment" });
  } catch (error) {
    next(error);
  }
};
