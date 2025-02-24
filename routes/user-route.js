const express = require("express")
const { route } = require("./auth-route")
const userRouter = express.Router()

userRouter.get("/")
userRouter.patch("/update-profile")
userRouter.delete("/:id")


module.exports = userRouter