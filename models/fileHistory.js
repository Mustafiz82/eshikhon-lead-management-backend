import mongoose from "mongoose";

const fileSchema = new mongoose.Schema({
    fileName: { type: String, required: true, unique: true },
    date: { type: Date, default: Date.now }
});

export default mongoose.model("FileName", fileSchema);
