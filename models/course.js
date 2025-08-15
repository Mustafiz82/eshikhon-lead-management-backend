import mongoose from "mongoose";

const courseSchema = new mongoose.Schema(
    {
        name: { type: String, required: true },
        type: { type: String, enum: ["Online", "Offline", "Video"], required: true },
        price: { type: Number, required: true }
    },
    {
        timestamps: true
    }
) 

export default mongoose.model("Course" , courseSchema)