const express = require("express");
const shareItemRouter = express.Router();
const shareItemController = require("../controllers/itemShare-controller");

shareItemRouter.post("/", shareItemController.createShareItem);
shareItemRouter.get("/:id", shareItemController.getShareItem);
shareItemRouter.patch("/:id", shareItemController.updateShareItem);
shareItemRouter.delete("/:id", shareItemController.deleteShareItem);

module.exports = shareItemRouter;
