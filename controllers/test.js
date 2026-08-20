import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import "dotenv/config";
import lead from "../models/lead.js";

async function updateLead() {
  await connectDB(process.env.MONGODB_URI);

  // Update Monir Hossen's assignDate to 20th July 2026
  const result = await lead.updateOne(
    { _id: "6a71b962cf34d761a0c43b88" },
    { $set: { assignDate: new Date("2026-07-20T00:00:00.000Z") } }
  );

  console.log("Update result:", result);

  await mongoose.disconnect();
}

updateLead().catch(console.error);