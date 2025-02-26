const prisma = require("../configs/prisma");

exports.createShareItem = async (req, res, next) => {
  try {
    res.json({ message: "Create Share Item" });
  } catch (error) {
    next(error);
  }
};

exports.getShareItem = async (req, res, next) => {
  try {
    res.json({ message: "Get Share Item" });
  } catch (error) {
    next(error);
  }
};

exports.updateShareItem = async (req, res, next) => {
  try {
    res.json({ message: "Update Share Item" });
  } catch (error) {
    next(error);
  }
};

exports.deleteShareItem = async (req, res, next) => {
  try {
    res.json({ message: "Delete Share Item" });
  } catch (error) {
    next(error);
  }
};
