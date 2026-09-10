import mongoose from "mongoose";

const callLogSchema = new mongoose.Schema(
  {
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "lead", // make sure this matches your lead model name
      required: true,
    },
    agentEmail: {
      type: String,
      required: true,
      trim: true,
    },
    leadStatus: {
      type: String,
      default: "Unknown",
    },
    calledAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

// ⚡ Compound index for instant aggregation speed
callLogSchema.index({ calledAt: 1, agentEmail: 1, leadStatus: 1 });

export const CallLog = mongoose.model("CallLog", callLogSchema);