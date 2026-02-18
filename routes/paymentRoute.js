import express from "express"
import { getAllAgentsMonthlyPayments } from "../controllers/paymentsController.js"
const paymentRoute = express.Router()


paymentRoute.get("/" , getAllAgentsMonthlyPayments)





export default paymentRoute    