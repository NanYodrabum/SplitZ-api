const prisma = require("../configs/prisma");

exports.updateUser = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { name, email } = req.body;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        name: name,
        email: email,
      },
    });

    res.json({
      message: "User updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteUser = async (req, res, next) => {
  try {
    const userId = req.params;

    await prisma.user.delete({
      where: { id: userId },
    });

    res.json({
      message: "User deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};
