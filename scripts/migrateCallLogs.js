import mongoose from "mongoose";
import lead from "../models/lead.js";
import { connectDB } from "../config/db.js";
import { CallLog } from "../models/CallLog.js";
import "dotenv/config";

const MONGO_URI = process.env.MONGODB_URI;

async function runMigration() {
  try {
    await connectDB(MONGO_URI);
    console.log("Connected to MongoDB.");

    console.log("Fetching leads...");
    const leads = await lead
      .find({ lastContacted: { $exists: true, $ne: null } })
      .select("_id assignTo leadStatus lastContacted")
      .lean();

    console.log(`Found ${leads.length} leads. Starting migration in batches of 100...`);

    const records = leads.map((l) => ({
      leadId: l._id,
      agentEmail: l.assignTo ? String(l.assignTo).trim().toLowerCase() : "n/a",
      leadStatus: l.leadStatus || "Unknown",
      calledAt: new Date(l.lastContacted),
    }));

    const batchSize = 100;
    for (let i = 0; i < records.length; i += batchSize) {
      const chunk = records.slice(i, i + batchSize);

      // Insert 100 at a time using Promise.all
      await Promise.all(chunk.map((doc) => CallLog.create(doc)));

      console.log(`Migrated: ${Math.min(i + batchSize, records.length)} / ${records.length}`);
    }

    console.log("Migration complete!");
  } catch (error) {
    console.error("Error during migration:", error);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

runMigration();