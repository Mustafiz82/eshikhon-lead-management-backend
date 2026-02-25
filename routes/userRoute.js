import express from "express";
import {
  createUser,
  deleteUser,
  getAllUser,
  getUser,
  login,
  updateUser,
} from "../controllers/userController.js";
import { getPaymentInfo, updatePaymentInfo } from "../controllers/paymentInfoController.js";
const userRoute = express.Router();

userRoute.post("/login", login);
userRoute.post("/", createUser);
userRoute.get("/", getAllUser);
userRoute.get("/:id", getUser);
userRoute.put("/:id", updateUser);
userRoute.delete("/:id", deleteUser);
// Get current payment info
userRoute.get("/:email/payment-info", getPaymentInfo);

// Update payment info
userRoute.put("/:email/payment-info", updatePaymentInfo);

// Optional: Get payment info change history
// userRoute.get("/:email/payment-info/history", getPaymentInfoHistory);

export default userRoute;
