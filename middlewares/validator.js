const { z, Schema } = require("zod");

exports.registerSchema = z
  .object({
    name: z.string().min(4, "Name should be more than 4 characters"),
    email: z.string().email("Email pattern is not correct"),
    password: z.string().min(6, "Password should be more than 6 characters"),
    confirmPassword: z
      .string()
      .min(6, "ConfirmPassword should be more than 6 characters"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Confirm password is not match with password",
    path: ["confirmPassword"],
  });

exports.loginSchema = z.object({
  email: z.string().email("Email pattern is not correct"),
  password: z.string().min(6, "Password should be more than 6 characters"),
});

exports.validateWithZod = (schema) => (req, res, next) => {
  try {
    schema.parse(req.body);
    next();
  } catch (error) {
    const errMsg = error.errors.map((item) => item.message);
    const errTxt = errMsg.join(",");
    const mergeError = new Error(errTxt);
    next(mergeError);
  }
};
