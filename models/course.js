import mongoose from "mongoose";

const courseSchema = new mongoose.Schema(
  {
    name: { 
      type: String, 
      required: true, 
      trim: true 
    },
    code: { 
      type: String, 
      trim: true 
    },
    allowedTypes: [
      {
        type: String,
        enum: [
          "Online",
          "Offline",
          "Video Course",
          "Download Course",
          "Free course",
        ],
      },
    ],
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Course", courseSchema);