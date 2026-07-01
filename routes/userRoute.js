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
import {  verifyToken } from "../middleware/authMiddleware.js";
const userRoute = express.Router();

userRoute.post("/login", login);
userRoute.post("/",   createUser);
userRoute.get("/",   getAllUser);
userRoute.get("/:id",  getUser);
userRoute.put("/:id",  updateUser);
userRoute.delete("/:id",   deleteUser);
userRoute.get("/:email/payment-info",  getPaymentInfo);
userRoute.put("/:email/payment-info",  updatePaymentInfo);

export default userRoute;
