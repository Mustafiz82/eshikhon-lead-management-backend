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
    const { id } = req.params;

    // Only allow known fields
    const allowed = [
      "name",
      "authority",
      "mode",
      "value",
      "minValue",
      "maxValue",
      "capAmount",
      "startAt",
      "expireAt",
      "appliesTo",
      "notes"
    ];
    const payload = Object.fromEntries(
      Object.entries(req.body || {}).filter(([k]) => allowed.includes(k))
    );

    const discount = await Discount.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true,
    });

    if (!discount) return res.status(404).json({ error: "discount not found" });

    return res.json(discount);
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ error: err.message });
    }
    return res.status(400).json({ error: "Invalid id or payload" });
  }
};


/**
 * DELETE /discount
 * Delete discounts by filter
 */
// export const deleteDiscount = async (req, res) => {
//   try {
//     const { filter } = req.body;
//     if (!filter) {
//       return res.status(400).json({ error: "filter is required" });
//     }
//     const result = await Discount.deleteMany(filter);
//     res.json({ deletedCount: result.deletedCount });
//   } catch (error) {
//     res.status(400).json({ error: error.message });
//   }
// };

export const deleteDiscount = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: "id is required" });
    }

    const discount = await Discount.findByIdAndDelete(id);

    if (!discount) {
      return res.status(404).json({ error: "discount not found" });
    }

    return res.json({ message: "discount deleted", id });
  } catch (error) {
    return res.status(400).json({ error: "Invalid id" });
  }
};
