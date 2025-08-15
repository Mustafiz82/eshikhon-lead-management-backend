// routes/discountRoute.js
import { Router } from "express";
import { createDiscount, deleteDiscount, getDiscounts, updateDiscount } from "../controllers/discountController.js";


const discountRouter = Router();

discountRouter.get("/", getDiscounts);      // List all discounts
discountRouter.post("/", createDiscount );   // Create discount
discountRouter.put("/", updateDiscount);    // Update by filter
discountRouter.delete("/", deleteDiscount); // Delete by filter

export default discountRouter;
