const express = require("express")
const paymentRouter = express.Router()
const paymentController = require("../controllers/payment-controller")
const { authCheck } = require("../middlewares/authCheck");

// Apply authentication middleware
paymentRouter.use(authCheck);

paymentRouter.patch("/", paymentController.updataPayment)
paymentRouter.get("/:billId", paymentController.getPaymentSummary)

module.exports = paymentRouter