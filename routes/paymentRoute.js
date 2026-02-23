import express from "express";
import {
  closeCommissionMonth,
  getAllAgentsMonthlyPayments,
  getCommissionList,
  getCommissionPaymentHistory,
  getLastPaymentInfo,
  payCommission,
} from "../controllers/paymentsController.js";
const paymentRoute = express.Router();

paymentRoute.get("/", getAllAgentsMonthlyPayments);
paymentRoute.get("/commissions", getCommissionList);
paymentRoute.post("/commissions/pay", payCommission);
paymentRoute.get("/commissions/history", getCommissionPaymentHistory);
paymentRoute.post("/commissions/close", closeCommissionMonth);
paymentRoute.get("/last/:agentEmail", getLastPaymentInfo);

export default paymentRoute;
