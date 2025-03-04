const express = require("express");
const shareItemRouter = express.Router();
const shareItemController = require("../controllers/itemShare-controller");
const { authCheck } = require("../middlewares/authCheck");

// Apply authentication to all share routes
shareItemRouter.use(authCheck);

// shareItemRouter.post("/", shareItemController.createShareItem);
// shareItemRouter.get("/:id", shareItemController.getShareItem);
// shareItemRouter.patch("/:id", shareItemController.updateShareItem);
// shareItemRouter.delete("/:id", shareItemController.deleteShareItem);

module.exports = shareItemRouter;
