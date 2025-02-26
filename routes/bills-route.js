const express = require("express");
const billRouter = express.Router();
const billController = require("../controllers/bills-controller");
const { authCheck } = require("../middlewares/authCheck");

// Apply authentication to all bill routes
billRouter.use(authCheck);

billRouter.post("/", billController.createBill);
billRouter.get("/", billController.getAllBill);
billRouter.get("/:id", billController.getSingleBill);
billRouter.patch("/:id", billController.editBill);
billRouter.delete("/:id", billController.deleteBill);

module.exports = billRouter;