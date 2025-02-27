const express = require("express");
const billRouter = express.Router();
const billController = require("../controllers/bills-controller");
const { authCheck } = require("../middlewares/authCheck");

// Apply authentication to all bill routes
billRouter.use(authCheck);

// Verify that all controller methods exist before adding routes
if (!billController.createBill) {
  throw new Error("createBill controller is not defined");
}
if (!billController.getAllBill) {
  throw new Error("getAllBill controller is not defined");
}
if (!billController.getSingleBill) {
  throw new Error("getSingleBill controller is not defined");
}
if (!billController.editBill) {
  throw new Error("editBill controller is not defined");
}
if (!billController.deleteBill) {
  throw new Error("deleteBill controller is not defined");
}

billRouter.post("/", billController.createBill);
billRouter.get("/", billController.getAllBill);
billRouter.get("/:id", billController.getSingleBill);
billRouter.patch("/:id", billController.editBill);
billRouter.delete("/:id", billController.deleteBill);

module.exports = billRouter;
