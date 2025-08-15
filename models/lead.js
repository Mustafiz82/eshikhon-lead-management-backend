import mongoose from "mongoose";

const leadSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true, index: true },
    address: { type: String, trim: true },
    email: {
      type: String,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      required: true,
      lowercase: true,
      index: true
    },
    questions: { type: mongoose.Schema.Types.Mixed },
    seminarTopic: {
      type: String,
      default: "not provided"
    },
    assignTo: { type: String, default: "N/A" },
    assignStatus: { type: Boolean, default: false },
    assignDate: { type: Date },

    leadType: { type: String, enum: ["potential leads", "open Pool"] },
    leadDiscount: { type: Number },
    DiscountUnit: {
      type: String, enum: [
        "parcent",
        "flat"
      ]
    },
    DiscountSource: {},
    leadSource: {
      type: String,

    },
    leadStatus: {
      type: String,

    },
    note: [
      {
        text: { type: String, trim: true },
        createdAt: { type: Date, default: Date.now }
      }
    ],
    lastContacted: { type: Date },
    followUpDate: { type: Date },
    callCount: { type: Number, default: 0 },
    sourceFileName: { type: String, trim: true, index: true },

  },
  { timestamps: true }
);

export default mongoose.model("Lead", leadSchema);
