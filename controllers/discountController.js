// controllers/discountController.js

import Discount from "../models/discounts.js";


/**
 * GET /discount
 * List all discounts
 */
export const getDiscounts = async (req, res) => {
  try {
    const discounts = await Discount.find().sort({ createdAt: -1 });
    res.json(discounts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * POST /discount
 * Create a new discount
 */
export const createDiscount = async (req, res) => {
  try {
    const discount = new Discount(req.body);
    await discount.save();
    res.status(201).json(discount);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

/**
 * PUT /discount
 * Update multiple discounts (or based on filter)
 */
export const updateDiscount = async (req, res) => {
  try {
    const { filter, update } = req.body;
    if (!filter || !update) {
      return res.status(400).json({ error: "filter and update fields are required" });
    }
    const result = await Discount.updateMany(filter, update, { runValidators: true });
    res.json({ modifiedCount: result.modifiedCount });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

/**
 * DELETE /discount
 * Delete discounts by filter
 */
export const deleteDiscount = async (req, res) => {
  try {
    const { filter } = req.body;
    if (!filter) {
      return res.status(400).json({ error: "filter is required" });
    }
    const result = await Discount.deleteMany(filter);
    res.json({ deletedCount: result.deletedCount });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
