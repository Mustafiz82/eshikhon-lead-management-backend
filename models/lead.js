import mongoose from "mongoose";

const leadSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    phone: { type: String, trim: true, },
    address: { type: String, trim: true },
    email: {
      type: String,

      lowercase: true,

    },
    questions: { type: mongoose.Schema.Types.Mixed },   // other will be in quesiont preoper , seminarSource add , source file name
    interstedCourse: {
      type: String,
      default: "not provided"
    },
    interstedCourseType: { type: String, enum: ["Online", "Offline", "Video"], default: "Online" },
    leadSource: {
      type: String,
      default: "Not Provided"
    },
    createdBy: { type: String, required: true },
    assignTo: { type: String, default: "N/A" },
    assignStatus: { type: Boolean, default: false },
    assignDate: { type: Date },
    leadType: { type: String, enum: ["potential leads", "open Pool"], default: "potential leads" },

    interstedSeminar: { type: String, enum: ["Joined", "Online", "Offline", "None"], default: "None" },
    enrolledTo: { type: String },
    leadStatus: {
      type: String,
      enum: [
        "Enrolled",
        "Not Interested",
        "Enrolled in Other Institute",
        "Call later",
        "Call Not Received",
        "Number Off or Busy",
        "Wrong Number",
        "Will Register",
        "Already Enrolled",
        "On hold",
        "Pending",
        "Refunded"
      ],
      default: "Pending"

    },
    leadDiscount: { type: Number, default: 0 },   // the discount amount
    discountUnit: {
      type: String,
      enum: ["percent", "flat"],
      default: "flat"
    },                                            // discout unit

    discountSource: {
      type: String,
      trim: true
    },                                            // discount sourse

    originalPrice: {
      type: Number,
      default: 0
    },                                             // buying price of course

    discountedPrice: {
      type: Number,
      default: 0
    },                                              // value after discoutn couon applid calculated with discoutn unit and amoutn always in amount 

    isLocked: {                                     // admin can lock leads 
      type: Boolean,
      default: false
    },



    totalPaid: { type: Number, default: 0 },        // How much in total he have paid 
    totalDue: { type: Number, default: 0 },         // how much total due he  has  to pay 

    refundAmount: { type: Number, default: 0 },     // How much amount is refunded  

    history: [                                      // payment history 
      {
        date: { type: Date, default: Date.now },
        paidAmount: { type: Number, default: 0 }
      }
    ],

    note: [                                          // notes automatic + menual 
      {
        text: { type: String, trim: true },
        createdAt: { type: Date, default: Date.now, },
        by: { type: String }
      }
    ],

    lastContacted: { type: Date },                   // when last contacted with lead 
    lastModifiedBy: { type: String },                // who modified last 
    enrolledAt: { type: Date },                      // The date first time it marked as enrolled 
    followUpDate: { type: Date },                    // when the leads need to call again 
    sourceFileName: { type: String, trim: true, },   // file name of uploaded lead 
    nextEstimatedPaymentDate: {                      // when user might paid later if downpayment happense
      type: Date
    },
  },
  { timestamps: true }
);


leadSchema.index({ email: 1 });
leadSchema.index({ assignTo: 1, assignDate: 1 });
leadSchema.index({ leadStatus: 1, enrolledAt: 1 });
leadSchema.index({ createdAt: -1 });



export default mongoose.model("Lead", leadSchema);

