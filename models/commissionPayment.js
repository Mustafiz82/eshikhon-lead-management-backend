import mongoose from "mongoose";

const commissionPaymentSchema = new mongoose.Schema(
  {
    agentEmail: { type: String, required: true, lowercase: true, trim: true },
    agentName: { type: String, default: "" },
    monthKey: { type: String, required: true, trim: true },

    amount: { type: Number, required: true, min: 0 },

    method: { type: String, default: "" },
    reference: { type: String, default: "" },
    note: { type: String, default: "" },

    payer: {
      name: { type: String, default: "" },
      number: { type: String, default: "" },
      accountType: { type: String, default: "" },
    },

    payee: {
      name: { type: String, default: "" },
      number: { type: String, default: "" },
      accountDetails: { type: String, default: "" },
    },

    paidBy: { type: String, default: "admin" },
    paidAt: { type: Date, default: Date.now },

    status: {
      type: String,
      enum: ["completed", "voided"],
      default: "completed",
    },
    paymentInfoSnapshot: {
      name: { type: String, default: "" },
      accountNumber: { type: String, default: "" },
      accountDetails: { type: String, default: "" },
    },
  },
  { timestamps: true },
);

commissionPaymentSchema.index({ agentEmail: 1, monthKey: 1, paidAt: -1 });

export default mongoose.model("CommissionPayment", commissionPaymentSchema);
