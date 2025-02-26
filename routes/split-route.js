const express = require("express");
const splitRouter = express.Router();
const splitController = require("../controllers/split-controller");

splitRouter.get("/", splitController.splitSummary);

module.exports = splitRouter;
