const jwt = require("jsonwebtoken");
const createError = require("../utils/createError");
const { request } = require("express");

exports.authCheck = async (req, res, next) => {
  try {
    const authorization = req.headers.authorization;
    if (!authorization) return createError(400, "Missing Token!!!");
    const token = authorization.split(" ")[1];
    jwt.verify(token, process.env.JWT_SECRET, (err, decode) => {
      if (err) {
        return createError(400, "Unauthorized!!!!");
      }
      req.user = decode;
      next();
    });
  } catch (error) {
    next(error);
  }
};
