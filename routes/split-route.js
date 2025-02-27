const express = require("express");
const splitRouter = express.Router();
const splitController = require("../controllers/split-controller");
const { authCheck } = require("../middlewares/authCheck");

// Apply authentication middleware
splitRouter.use(authCheck);

// Use the exported controller functions
splitRouter.get("/", splitController.splitSummary);
splitRouter.get("/user/:otherUserId", splitController.userSplitDetails);

module.exports = splitRouter;
