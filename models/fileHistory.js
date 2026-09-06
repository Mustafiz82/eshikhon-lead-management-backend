import mongoose from "mongoose";

const fileSchema = new mongoose.Schema({
    fileName: { type: String, required: true, unique: true },
    type: { type: String,}, 
    date: { type: Date, default: Date.now },
    insertedLeads: { type: [String], default: [] },    
    duplicateLeads: [
        {
            phone: { type: String, required: true },
            course: [String], 
            reason: { type: String }
        }
    ]
});

export default mongoose.model("FileName", fileSchema);