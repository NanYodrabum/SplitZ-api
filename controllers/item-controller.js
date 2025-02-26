const prisma = require("../configs/prisma");

exports.createItem = async (req,res,next) => {
    try {
        res.json({message: "Create Item"})
    } catch (error) {
        next(error)
    }
}

exports.getItem = async (req,res,next) => {
    try {
        res.json({message:"Get item"})
    } catch (error) {
        next(error)
    }
}

exports.updateItem = async (req,res,next) => {
    try {
        res.json({message: "Update item"})
    } catch (error) {
        next(error)
    }
}

exports.deleteItem = async (req,res,next) => {
    try {
        res.json({message: "Delete item"})
    } catch (error) {
       next (error) 
    }
}