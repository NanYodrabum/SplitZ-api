const prisma = require("../configs/prisma");

exports.splitSummary = async (req, res, next) => {
  try {
    res.json({ message: "Split Summary" });
  } catch (error) {
    next(error);
  }
};
