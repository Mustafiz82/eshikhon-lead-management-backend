import User from "../models/user.js";
import PaymentInfoHistory from "../models/paymentInfoHistory.js";

export const updatePaymentInfo = async (req, res) => {
  try {
    const { email } = req.params;
    const { name, accountNumber, accountDetails } = req.body;
    const changedBy = req.body.changedBy || "system";

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const oldInfo = user.paymentInfo || {};
    const newInfo = { name, accountNumber, accountDetails };

    const changedFields = [];

    if (oldInfo.name !== name) changedFields.push("name");
    if (oldInfo.accountNumber !== accountNumber) changedFields.push("accountNumber");
    if (oldInfo.accountDetails !== accountDetails) changedFields.push("accountDetails");

    if (changedFields.length === 0) {
      return res.json({ message: "No changes detected" });
    }

    // Save history
    await PaymentInfoHistory.create({
      userEmail: email,
      previous: oldInfo,
      updated: newInfo,
      changedFields,
      changedBy
    });

    // Update user
    user.paymentInfo = {
      name,
      accountNumber,
      accountDetails,
      updatedAt: new Date(),
      updatedBy: changedBy
    };

    await user.save();

    return res.json({ message: "Payment info updated successfully" });

  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
};




export const getPaymentInfo = async (req, res) => {
  try {
    const { email } = req.params;

    const user = await User.findOne({ email }).lean();
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json(user.paymentInfo || {});

  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
};