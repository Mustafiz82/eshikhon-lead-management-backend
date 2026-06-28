import express from "express";
import {
  createUser,
  deleteUser,
  getAllUser,
  getUser,
  login,
  updateUser,
} from "../controllers/userController.js";
import {
  getPaymentInfo,
  updatePaymentInfo,
} from "../controllers/paymentInfoController.js";
import { verifyAdmin, verifyToken } from "../middleware/authMiddleware.js";
const userRoute = express.Router();

userRoute.post("/login", login);
userRoute.post("/", verifyToken, verifyAdmin, createUser);
userRoute.get("/", verifyToken, verifyAdmin, getAllUser);
userRoute.get("/:id", verifyToken, getUser);
userRoute.put("/:id", verifyToken, updateUser);
userRoute.delete("/:id", verifyToken, verifyAdmin, deleteUser);
userRoute.get("/:email/payment-info", verifyToken, getPaymentInfo);
userRoute.put("/:email/payment-info", verifyToken, updatePaymentInfo);

export default userRoute;
