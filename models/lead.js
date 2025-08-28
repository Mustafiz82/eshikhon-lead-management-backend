import mongoose from "mongoose";

const leadSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true, index: true },
    address: { type: String, trim: true },
    email: {
      type: String,
      required: true,
      lowercase: true,
      index: true
    },
    questions: { type: mongoose.Schema.Types.Mixed },   // other will be in quesiont preoper , seminarSource add , source file name
    seminarTopic: {
      type: String,
      default: "not provided"
    },
    assignTo: { type: String, default: "N/A" },
    assignStatus: { type: Boolean, default: false },
    assignDate: { type: Date },

    leadType: { type: String, enum: ["potential leads", "open Pool"], default: "potential leads" },
    leadSource: {
      type: String,
      default: "seminar"

    },
    leadStatus: {
      type: String,
      enum: [
        "Enrolled",
        "Will Join on Seminar",
        "Not Interested",
        "Enrolled in Other Institute",
        "Cut the Call",
        "Call Not Received",
        "Number Off or Busy",
        "Wrong Number",
        "N/A"
      ],
      default : "N/A"

    },
    leadDiscount: { type: Number, default: 0 },
    discountUnit: {
      type: String,
      enum: ["percent", "flat"],
      default: "percent"
    },

    discountSource: {
      type: String,
      trim: true
    },

    originalPrice: {
      type: Number,
      default: 0
    },

    discountedPrice: {
      type: Number,
      default: 0
    },

    discountPercent: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },

    // totalPaid: {
    //   type: Number,
    //   default: 0
    // },

    // totalDue: {
    //   type: Number,
    //   default: 0
    // },

    // nextEstimatedPaymentDate: {
    //   type: Date
    // },

    // history: [
    //   {
    //     date: { type: Date, default: Date.now },
    //     paidAmount: { type: Number, default: 0 },
    //     paidPercent: { type: Number, min: 0, max: 100, default: 0 }
    //   }
    // ]

    note: [
      {
        text: { type: String, trim: true },
        createdAt: { type: Date, default: Date.now }
      }
    ],

    lastContacted: { type: Date  },
    followUpDate: { type: Date },
    callCount: { type: Number, default: 0 },
    sourceFileName: { type: String, trim: true, index: true },
  },
  { timestamps: true }
);

export default mongoose.model("Lead", leadSchema);
