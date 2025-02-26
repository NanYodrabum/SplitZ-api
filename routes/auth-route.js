const express = require("express");
const authRouter = express.Router();
const authControllers = require("../controllers/auth-controller");
const {
  validateWithZod,
  registerSchema,
  loginSchema,
} = require("../middlewares/validator");
const { authCheck } = require("../middlewares/authCheck");

authRouter.post(
  "/register",
  validateWithZod(registerSchema),
  authControllers.register
);
authRouter.post("/login", validateWithZod(loginSchema), authControllers.login);
authRouter.post("/me", authCheck ,authControllers.currentUser);

module.exports = authRouter;
