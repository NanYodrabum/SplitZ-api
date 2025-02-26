const prisma = require("../configs/prisma");

exports.createBill = async (req, res, next) => {
  try {
    res.json({ message: "Create Bill Successful" });
  } catch (error) {
    next(error);
  }
};

exports.getAllBill = async (req, res, next) => {
  try {
    res.json({ message: "Get All Bills" });
  } catch (error) {
    next(error);
  }
};

exports.getSingleBill = async (req,res,next)=> {
    try {
        res.json({message: "Get A bill"})
    } catch (error) {
       next(error) 
    }
}

exports.editBill = async (req,res,next) => {
    try {
        res.json({message: "Edit Bill"})
    } catch (error) {
        next(error)
    }
}

exports.deleteBill = async (req,res,next) => {
    try {
        res.json({message: "Delete Bill"})
    } catch (error) {
        next(error)
    }
}