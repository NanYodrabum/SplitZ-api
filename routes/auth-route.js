const express = require("express");
const authRoute = express.Router();
const authControllers = require("../controllers/auth-controller");
const {
  validateWithZod,
  registerSchema,
  loginSchema,
} = require("../middlewares/validator");
const { authCheck } = require("../middlewares/authCheck");

authRoute.post(
  "/register",
  validateWithZod(registerSchema),
  authControllers.register
);
authRoute.post("/login", validateWithZod(loginSchema), authControllers.login);
authRoute.post("/me", authCheck ,authControllers.currentUser);

module.exports = authRoute;
