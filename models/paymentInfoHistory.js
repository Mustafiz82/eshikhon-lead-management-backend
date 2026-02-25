import mongoose from "mongoose";

const paymentInfoHistorySchema = new mongoose.Schema({
  userEmail: { type: String, required: true },

  previous: {
    name: String,
    accountNumber: String,
    accountDetails: String
  },

  updated: {
    name: String,
    accountNumber: String,
    accountDetails: String
  },

  changedFields: [String],

  changedBy: String,

  changedAt: {
    type: Date,
    default: Date.now
  }
});

paymentInfoHistorySchema.index({ userEmail: 1, changedAt: -1 });

export default mongoose.model("PaymentInfoHistory", paymentInfoHistorySchema);