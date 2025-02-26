const express = require("express");
const itemRouter = express.Router();
const itemController = require("../controllers/item-controller");
const { authCheck } = require("../middlewares/authCheck");

// Apply authentication to all item routes
itemRouter.use(authCheck);

itemRouter.post("/", itemController.createItem);
itemRouter.get("/:id", itemController.getItem);
itemRouter.patch("/:id", itemController.updateItem);
itemRouter.delete("/:id", itemController.deleteItem);

module.exports = itemRouter;
