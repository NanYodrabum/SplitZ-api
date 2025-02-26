require("dotenv").config();
const morgan = require("morgan");
const express = require("express");
const cors = require("cors");
const notFound = require("./middlewares/notFound");
const handleError = require("./middlewares/handleError");
const authRouter = require("./routes/auth-route");
const userRouter = require("./routes/user-route");
const billRouter = require("./routes/bills-route");
const itemRouter = require("./routes/item-route");
const shareItemRouter = require("./routes/itemShare-route");
const splitRouter = require("./routes/split-route");
const paymentRouter = require("./routes/payment-route");
const app = express();

app.use(
  morgan(":method :url :status :res[content-length] - :response-time ms")
);
app.use(cors());
app.use(express.json());

app.use("/auth", authRouter);
app.use("/user", userRouter);
app.use("/bills", billRouter);
app.use("/items", itemRouter);
app.use("/shares", shareItemRouter)
app.use("/split", splitRouter)
app.use("/payment", paymentRouter)

// notFound
app.use(notFound);

// error middleware
app.use(handleError);

const port = process.env.PORT || 8000;
app.listen(port, () => console.log("Server is running on PORT", port));
