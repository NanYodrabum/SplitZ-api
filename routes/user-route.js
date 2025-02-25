const express = require("express")
const { authCheck } = require("../middlewares/authCheck")
const userRouter = express.Router()
const userController = require("../controllers/user-controller")


userRouter.get("/")
userRouter.patch("/update-profile",authCheck,userController.updateUser)
userRouter.delete("/:id",authCheck, userController.deleteUser )


module.exports = userRouter