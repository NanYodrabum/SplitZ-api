const prisma = require("../configs/prisma");
const createError = require("../utils/createError");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

exports.register = async (req, res, next) => {
  try {
    const { name, email, password, confirmPassword } = req.body;
    const checkEmail = await prisma.user.findFirst({
      where: { email: email },
    });
    if (checkEmail) {
      return createError(400, "This Email is already Exists!!!");
    }
    const hashedPassword = bcrypt.hashSync(password, 10);
    const profile = await prisma.user.create({
      data: {
        name: name,
        email: email,
        password: hashedPassword,
      },
    });
    res.json({ message: "Register Successful" });
  } catch (error) {
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const profile = await prisma.user.findFirst({
      where: {
        email: email,
      },
    });
    if (!profile) {
      return createError(400, "Email or Password is invalid!!");
    }
    const isMatch = bcrypt.compareSync(password, profile.password);
    if (!isMatch) {
      return createError(400, "Email or Password is invalid!!");
    }
    const payload = {
      id: profile.id,
      email: profile.email,
      name: profile.name,
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });
    res.json({
      message: "Login Successful",
      payload: payload,
      token: token,
    });
  } catch (error) {
    next(error);
  }
};

exports.currentUser = async (req, res, next) => {
  try {
    const { email } = req.user;
    const profile = await prisma.user.findFirst({
      where: { email: email },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });
    res.json({ result: profile });
  } catch (error) {
    next(error);
  }
};
