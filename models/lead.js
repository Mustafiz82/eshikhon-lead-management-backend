import mongoose from "mongoose";

const leadSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true,  },
    address: { type: String, trim: true },
    email: {
      type: String,
      required: true,
      lowercase: true,
     
    },
    questions: { type: mongoose.Schema.Types.Mixed },   // other will be in quesiont preoper , seminarSource add , source file name
    seminarTopic: {
      type: String,
      default: "not provided"
    },
    seminarType: { type: String, enum: ["Online", "Offline", "Video"], required: true },
    createdBy: { type: String, required: true },
    assignTo: { type: String, default: "N/A" },
    assignStatus: { type: Boolean, default: false },
    assignDate: { type: Date },

    leadType: { type: String, enum: ["potential leads", "open Pool"], default: "potential leads" },
    leadSource: {
      type: String,
      default: "seminar"

    },
    enrolledTo: { type: String },
    leadStatus: {
      type: String,
      enum: [
        "Enrolled",
        "Will Join on Seminar",
        "Joined on seminar",
        "Not Interested",
        "Enrolled in Other Institute",
        "Cut the Call",
        "Call Not Received",
        "Number Off or Busy",
        "Wrong Number",
        "Pending"
      ],
      default: "Pending"

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

    nextEstimatedPaymentDate: {
      type: Date
    },

    totalPaid: { type: Number, default: 0 },   // cumulative
    totalDue: { type: Number, default: 0 },

    lastPayment: {
      date: { type: Date },
      paidAmount: { type: Number, default: 0 }
    },

    history: [
      {
        date: { type: Date, default: Date.now },
        paidAmount: { type: Number, default: 0 }
      }
    ],

    note: [
      {
        text: { type: String, trim: true },
        createdAt: { type: Date, default: Date.now ,},
        by: { type: String }
      }
    ],

    lastContacted: { type: Date },
    enrolledAt : {type : Date},
    followUpDate: { type: Date },
    callCount: { type: Number, default: 0 },
    sourceFileName: { type: String, trim: true,  },
  },
  { timestamps: true }
);


leadSchema.index({ email: 1 });
leadSchema.index({ assignTo: 1, assignDate: 1 });   
leadSchema.index({ leadStatus: 1, enrolledAt: 1 });
leadSchema.index({ createdAt: -1 });



export default mongoose.model("Lead", leadSchema);
