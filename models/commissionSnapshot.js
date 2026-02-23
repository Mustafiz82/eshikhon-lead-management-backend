import mongoose from "mongoose";

const commissionSnapshotSchema = new mongoose.Schema(
  {
    agentEmail: { type: String, required: true, lowercase: true, trim: true },
    agentName: { type: String, default: "" },

    // "2025-11"
    monthKey: { type: String, required: true, trim: true },

    // display only (optional)
    monthLabel: { type: String, default: "" },

    totalSales: { type: Number, default: 0 },
    basePrice: { type: Number, default: 0 },
    targetCompletionRate: { type: Number, default: 0 },
    commissionDue: { type: Number, default: 0 },

    // locked means "closed month"
    locked: { type: Boolean, default: false },

    // if you change commission formula later
    calcVersion: { type: String, default: "v1" },
  },
  { timestamps: true }
);

// One snapshot per agent per month
commissionSnapshotSchema.index({ agentEmail: 1, monthKey: 1 }, { unique: true });
commissionSnapshotSchema.index({ monthKey: 1, locked: 1 });

export default mongoose.model("CommissionSnapshot", commissionSnapshotSchema);
