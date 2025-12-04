import mongoose from "mongoose"
import lead from "../models/lead.js"
import course from "../models/course.js";


// export const createLead = async (req, res) => {
//     try {
//         // Always work with an array
//         let leads = Array.isArray(req.body) ? req.body : [req.body];

//         // Step 1️⃣ — Normalize values
//         leads = leads.map(lead => {

//             return {
//                 ...lead,
//                 phone: String(lead.phone)?.trim(),
//                 interstedCourse: lead.interstedCourse?.trim() || "not provided",

//             };
//         });

//         if (leads.length === 0) {
//             return res.status(400).json({ error: "No leads provided" });
//         }

//         // Step 2️⃣ — Remove duplicates inside the same upload
//         const seenPairs = new Set();
//         const uniqueIncoming = [];
//         for (const l of leads) {
//             const key = `${l.phone}-${l.interstedCourse}`;
//             if (!seenPairs.has(key)) {
//                 seenPairs.add(key);
//                 uniqueIncoming.push(l);
//             }
//         }

//         // Step 3️⃣ — Find which of these already exist in the DB
//         const existing = await lead.find(
//             {
//                 $or: uniqueIncoming.map(l => ({
//                     phone: l.phone,
//                     interstedCourse: l.interstedCourse,
//                 })),
//             },
//             { phone: 1, interstedCourse: 1 }
//         ).lean();

//         // Step 4️⃣ — Create a Set of existing pairs
//         const existingPairs = new Set(
//             existing.map(e => `${e.phone}-${e.interstedCourse}`)
//         );

//         // Step 5️⃣ — Keep only truly new ones
//         const newLeads = uniqueIncoming.filter(
//             l => !existingPairs.has(`${l.phone}-${l.interstedCourse}`)
//         );

//         if (newLeads.length === 0) {
//             return res.status(200).json({
//                 ok: false,
//                 message: "All leads are duplicates .",
//                 insertedCount: 0,
//                 skippedCount: leads.length,
//             });
//         }

//         // Step 6️⃣ — Insert unique leads
//         const inserted = await lead.insertMany(newLeads);

    


//         return res.status(201).json({
//             ok: true,
//             message: `${inserted.length} new leads added, ${leads.length - inserted.length} skipped.`,
//             insertedCount: inserted.length,
//             skippedCount: leads.length - inserted.length,
//             failedToInsert : failedToInsert
//         });
//     } catch (error) {
//         console.error("createLead error:", error);
//         res.status(500).json({ error: error.message });
//     }
// };


export const createLead = async (req, res) => {
    try {
        // Always work with an array
        let leads = Array.isArray(req.body) ? req.body : [req.body];

        // Step 1️⃣ — Normalize values
        leads = leads.map(lead => {
            return {
                ...lead,
                phone: String(lead.phone)?.trim(),
                interstedCourse: lead.interstedCourse?.trim() || "not provided",
            };
        });

        if (leads.length === 0) {
            return res.status(400).json({ error: "No leads provided" });
        }

        // Initialize arrays for our categories
        const duplicatesInPayload = [];
        const duplicatesInDB = [];
        const uniqueIncoming = []; // These are candidates for DB check

        // Step 2️⃣ — Remove duplicates inside the same upload
        const seenPairs = new Set();

        for (const l of leads) {
            const key = `${l.phone}-${l.interstedCourse}`;

            if (seenPairs.has(key)) {
                // Category 1: Duplicate inside the uploaded file
                duplicatesInPayload.push(l);
            } else {
                seenPairs.add(key);
                uniqueIncoming.push(l);
            }
        }

        // Step 3️⃣ — Find which of the unique candidates already exist in the DB
        let existingPairs = new Set();

        if (uniqueIncoming.length > 0) {
            const existing = await lead.find(
                {
                    $or: uniqueIncoming.map(l => ({
                        phone: l.phone,
                        interstedCourse: l.interstedCourse,
                    })),
                },
                { phone: 1, interstedCourse: 1 }
            ).lean();

            // Create a Set for fast lookup
            existingPairs = new Set(
                existing.map(e => `${e.phone}-${e.interstedCourse}`)
            );
        }

        // Step 4️⃣ — Separate New Leads from DB Duplicates
        const newLeads = [];

        for (const l of uniqueIncoming) {
            const key = `${l.phone}-${l.interstedCourse}`;

            if (existingPairs.has(key)) {
                // Category 2: Already exists in the Database
                duplicatesInDB.push(l);
            } else {
                // Truly new lead
                newLeads.push(l);
            }
        }

        // Step 5️⃣ — Insert unique leads (if any)    
        let inserted = [];
        if (newLeads.length > 0) {
            inserted = await lead.insertMany(newLeads);
        }

        // Calculate totals
        const totalSkipped = duplicatesInPayload.length + duplicatesInDB.length;

        // Step 6️⃣ — Return the categorized response
        return res.status(201).json({
            ok: newLeads.length > 0, // True if at least one was inserted
            message: `${inserted.length} new leads added, ${totalSkipped} skipped.`,
            insertedCount: inserted.length,
            skippedCount: totalSkipped,
            
            // 🔹 The categorized skipped lists:
            duplicatesInPayload: duplicatesInPayload,
            duplicatesInDB: duplicatesInDB, 
        });

    } catch (error) {
        console.error("createLead error:", error);
        res.status(500).json({ error: error.message });
    }
};

export const createSingleLead = async (req, res) => {
    console.log(req.body)
    try {
        const result = await lead.insertOne(req.body)
        res.status(201).json(result)
    } catch (error) {
        res.status(400).json({ error: error.message })
    }
}



export const getAllLeads = async (req, res) => {

    try {
        console.log("hit")

        const {
            status,
            course,
            search,
            sort,
            interstedSeminar,
            limit,
            currentPage,
            createdBy,
            assignTo,
            leadStatus,
            stage,
            assignDate,
            showOnlyFollowups,
            followUpDate,
            showOnlyMissedFollowUps,
            fields,
            lock,
            leadSource,
            upcomingPaymentsDate,
            missedFollowUpDate } = req.query

        console.log(showOnlyFollowups, status, course, search, sort, limit, currentPage, createdBy, assignTo)

        console.log(search + "ends")


        const filter = {}
        let sortOption


        if (status && status !== "All") {
            filter.assignStatus = status;
        }

        if (course && course !== "All") {
            filter.interstedCourse = course
        }

        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
                { phone: { $regex: search, $options: "i" } },
            ]

        }

        if (assignTo && assignTo !== "All") {
            filter.assignTo = assignTo
        }

        if (createdBy) {
            filter.createdBy = createdBy
        }

        if (leadStatus && leadStatus !== "All") {
            filter.leadStatus = leadStatus
        }

        if (interstedSeminar && interstedSeminar !== "All") {
            filter.interstedSeminar = interstedSeminar
        }

        if (stage && stage !== "All") {
            if (stage == "Pending") filter.leadStatus = stage
            else filter.leadStatus = { $ne: "Pending" }
        }

        if (assignDate && assignDate !== "All") {
            const { start, end } = getDateRange(assignDate, "assign");
            if (start && end) filter.assignDate = { $gte: start, $lte: end };
        }

        if (showOnlyFollowups === "true") {
            filter.followUpDate = { $exists: true, $ne: null };
        }

        // For followUpDate (from today → Dec 31)
        if (followUpDate && followUpDate !== "All") {
            const { start, end } = getDateRange(followUpDate, "followup");
            if (start && end) filter.followUpDate = { $gte: start, $lte: end };
        }

        if (upcomingPaymentsDate && upcomingPaymentsDate !== "None") {

            if (upcomingPaymentsDate === "All") {
                // If "All" is selected, find all leads with a payment date from today onwards.
                const now = new Date();
                const localNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Dhaka" }));
                const startOfToday = new Date(localNow.setHours(0, 0, 0, 0));

                filter.nextEstimatedPaymentDate = {
                    $exists: true,
                    $gte: startOfToday
                };

            } else {
                // This handles all other date ranges: "Today", "Next 7 Days", "Pick a date", etc.
                const { start, end } = getDateRange(upcomingPaymentsDate, "followup");
                if (start && end) {
                    filter.nextEstimatedPaymentDate = { $gte: start, $lte: end };
                }
            }
        }


        if (showOnlyMissedFollowUps === "true") {
            const now = new Date();
            const bdNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Dhaka" }));

            filter.followUpDate = {
                $exists: true,
                $ne: null,
                $lt: bdNow,   // strictly before current date-time
            };
        }

        if (missedFollowUpDate && missedFollowUpDate !== "All") {
            const { start, end } = getDateRange(missedFollowUpDate, "missedFollowup");
            if (start && end) {
                followFilter.$gte = start;
                followFilter.$lte = end;
            }
        }

        if (lock && lock !== "All") {
            filter.isLocked = lock == "Locked" ? true : false
        }

        if (leadSource && leadSource !== "All") {
            filter.leadSource = leadSource
        }



        if (sort === "Ascending") {
            sortOption = { createdAt: 1, _id: 1 };
        } else if (sort === "Descending") {
            sortOption = { createdAt: -1, _id: -1 };
        } else {
            // Default (stable, newest first)
            sortOption = { createdAt: -1, _id: -1 };
        }


        let projection = null;
        if (fields === "table") {
            projection =
                "_id name email phone address interstedCourse leadStatus assignStatus createdAt isLocked interstedCourseType";
        }


        console.log(filter)

        const skip = (limit ? limit : 50) * ((currentPage ? currentPage : 1) - 1)

        console.log(status, course, search, sort, limit, currentPage)
        const leadRes = await lead.find(filter, projection).sort(sortOption).allowDiskUse().skip(skip).limit(limit ? limit : 50).lean()
        // console.log(leadRes)

        res.status(200).json(leadRes)
    } catch (error) {
        res.status(400).json({ error: error.message })
    }
}

export const getLeadSources = async (req, res) => {
    try {
        console.log("hit /getLeadSources");

        const sources = await lead.aggregate([
            {
                $match: {
                    leadSource: { $exists: true, $ne: null, $ne: "" }
                }
            },
            {
                $group: {
                    _id: "$leadSource"
                }
            },
            {
                $project: {
                    _id: 0,
                    leadSource: "$_id"
                }
            }
        ]);

        // Extract array of strings
        const uniqueSources = sources.map(item => item.leadSource);

        res.status(200).json(uniqueSources);
    } catch (error) {
        console.error("Error fetching lead sources:", error);
        res.status(500).json({ error: error.message });
    }
};


export const getInterestedCourses = async (req, res) => {
    try {
        console.log("hit /getInterestedCourses");

        // 1. Get unique 'interstedCourse' from the Lead collection
        // We use Promise.all to run both database queries at the same time for speed
        const [leadCourses, dbCourses] = await Promise.all([
            // Query 1: Aggregate unique courses from Leads
            lead.aggregate([
                {
                    $match: {
                        interstedCourse: { $exists: true, $ne: null, $ne: "" }
                    }
                },
                {
                    $group: {
                        _id: "$interstedCourse"
                    }
                },
                {
                    $project: {
                        _id: 0,
                        name: "$_id"
                    }
                }
            ]),

            // Query 2: Get all official course names from Course collection
            course.find({}, { name: 1, _id: 0 })
        ]);

        // 2. Extract arrays of strings
        const leadCourseNames = leadCourses.map(item => item.name);
        const dbCourseNames = dbCourses.map(item => item.name);

        // 3. Merge both arrays and remove duplicates using Set
        // This ensures if "Web Dev" is in both Leads and Course, it only appears once
        const uniqueCourses = [...new Set([...leadCourseNames, ...dbCourseNames])];

        // Optional: Sort them alphabetically
        uniqueCourses.sort();

        res.status(200).json(uniqueCourses);

    } catch (error) {
        console.error("Error fetching course filters:", error);
        res.status(500).json({ error: error.message });
    }
};



export const getLeadsCount = async (req, res) => {
    try {
        console.log("hit getLeadsCount");

        const {
            status,
            course,
            search,
            createdBy,
            assignTo,
            leadStatus,
            stage,
            assignDate,
            showOnlyFollowups,
            followUpDate,
            showOnlyMissedFollowUps,
            missedFollowUpDate,
            // Added missing params
            interstedSeminar,
            lock,
            leadSource,
            upcomingPaymentsDate
        } = req.query;

        const filter = {};

        // 1. Status
        if (status && status !== "All") {
            filter.assignStatus = status;
        }

        // 2. Course
        if (course && course !== "All") {
            filter.interstedCourse = course;
        }

        // 3. Search
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
                { phone: { $regex: search, $options: "i" } },
            ];
        }

        // 4. AssignTo (FIXED: Added check for "All")
        if (assignTo && assignTo !== "All") {
            filter.assignTo = assignTo;
        }

        // 5. CreatedBy
        if (createdBy) {
            filter.createdBy = createdBy;
        }

        // 6. LeadStatus
        if (leadStatus && leadStatus !== "All") {
            filter.leadStatus = leadStatus;
        }

        // 7. Seminar (ADDED)
        if (interstedSeminar && interstedSeminar !== "All") {
            filter.interstedSeminar = interstedSeminar;
        }

        // 8. Stage
        if (stage && stage !== "All") {
            if (stage === "Pending") filter.leadStatus = stage;
            else filter.leadStatus = { $ne: "Pending" };
        }

        // 9. AssignDate
        if (assignDate && assignDate !== "All") {
            const { start, end } = getDateRange(assignDate, "assign");
            if (start && end) filter.assignDate = { $gte: start, $lte: end };
        }

        // 10. Follow Ups Existence
        if (showOnlyFollowups === "true") {
            filter.followUpDate = { $exists: true, $ne: null };
        }

        // 11. Follow Up Date Range
        if (followUpDate && followUpDate !== "All") {
            const { start, end } = getDateRange(followUpDate, "followup");
            if (start && end) filter.followUpDate = { $gte: start, $lte: end };
        }

        // 12. Upcoming Payments (ADDED)
        if (upcomingPaymentsDate && upcomingPaymentsDate !== "None") {
            if (upcomingPaymentsDate === "All") {
                const now = new Date();
                const localNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Dhaka" }));
                const startOfToday = new Date(localNow.setHours(0, 0, 0, 0));

                filter.nextEstimatedPaymentDate = {
                    $exists: true,
                    $gte: startOfToday
                };
            } else {
                const { start, end } = getDateRange(upcomingPaymentsDate, "followup");
                if (start && end) {
                    filter.nextEstimatedPaymentDate = { $gte: start, $lte: end };
                }
            }
        }

        // 13. Missed Follow Ups Boolean
        if (showOnlyMissedFollowUps === "true") {
            const now = new Date();
            const bdNow = new Date(
                now.toLocaleString("en-US", { timeZone: "Asia/Dhaka" })
            );

            // Use spread to merge if followUpDate already exists from previous filters
            filter.followUpDate = {
                ...filter.followUpDate,
                $exists: true,
                $ne: null,
                $lt: bdNow,
            };
        }

        // 14. Missed Follow Up Date (FIXED LOGIC)
        if (missedFollowUpDate && missedFollowUpDate !== "All") {
            const { start, end } = getDateRange(missedFollowUpDate, "missedFollowup");
            const now = new Date();
            const bdNow = new Date(
                now.toLocaleString("en-US", { timeZone: "Asia/Dhaka" })
            );

            filter.followUpDate = {
                ...filter.followUpDate,
                $exists: true,
                $ne: null,
                $lt: bdNow,
                ...(start && end ? { $gte: start, $lte: end } : {})
            };
        }

        // 15. Lock (ADDED)
        if (lock && lock !== "All") {
            filter.isLocked = lock == "Locked" ? true : false;
        }

        // 16. Lead Source (ADDED)
        if (leadSource && leadSource !== "All") {
            filter.leadSource = leadSource;
        }

        console.log(filter, "count filter");

        const count = await lead.countDocuments(filter);

        res.status(200).json({ count });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};


export const updateLeads = async (req, res) => {
    try {
        const { ids } = req.body; // expect an array of lead IDs
        const updateData = req.body.update; // fields to update

        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: "No IDs provided" });
        }

        const result = await lead.updateMany(
            { _id: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) } },
            { $set: updateData },
            { runValidators: true }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ message: "No leads found" });
        }

        res.json({
            message: `${result.modifiedCount} leads updated successfully`,
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};



export const updateSingleLead = async (req, res) => {
    try {
        const { note: notes, paidAmount, ...rest } = req.body;

        const updateData = { $set: rest };

        // Handle notes
        if (notes && notes.length > 0) {
            updateData.$push = { ...(updateData.$push || {}), note: { $each: notes } };
        }

        // Handle payment


        console.log(paidAmount, "paid amoutn ")
        if (paidAmount && paidAmount > 0) {
            const paymentEntry = { paidAmount, date: new Date() };

            updateData.$inc = { ...(updateData.$inc || {}), totalPaid: paidAmount };
            updateData.$push = { ...(updateData.$push || {}), history: paymentEntry };
            updateData.$set = { ...(updateData.$set || {}), lastPayment: paymentEntry };
        }

        const updated = await lead.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        );

        if (!updated) return res.status(404).json({ message: "Lead not found" });
        res.json(updated);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
};



function getDateRange(type, mode = "assign", tz = "Asia/Dhaka") {
    const now = new Date();
    const localNow = new Date(now.toLocaleString("en-US", { timeZone: tz }));

    let start, end;

    // ------------------------
    // Assign Date filters
    // ------------------------
    if (type === "Today") {
        start = new Date(localNow.setHours(0, 0, 0, 0));
        end = new Date(localNow.setHours(23, 59, 59, 999));
    }

    if (type === "This Week") {
        const day = localNow.getDay();   // 0=Sunday … 6=Saturday
        const diff = (day + 1) % 7;      // Saturday = 0
        start = new Date(localNow);
        start.setDate(localNow.getDate() - diff);
        start.setHours(0, 0, 0, 0);

        end = new Date(start);
        end.setDate(start.getDate() + 6); // Friday
        end.setHours(23, 59, 59, 999);
    }

    if (type === "This Month") {
        start = new Date(localNow.getFullYear(), localNow.getMonth(), 1);
        end = new Date(localNow.getFullYear(), localNow.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    if (type === "This Year") {
        if (mode === "assign") {
            // full calendar year
            start = new Date(localNow.getFullYear(), 0, 1);
        } else {
            // followup mode = from today to end of year
            start = new Date(localNow.setHours(0, 0, 0, 0));
        }
        end = new Date(localNow.getFullYear(), 11, 31, 23, 59, 59, 999);
    }

    // ------------------------
    // Follow-up filters
    // ------------------------
    if (type === "Next 3 Days") {
        start = new Date(localNow.setHours(0, 0, 0, 0));
        end = new Date(start);
        end.setDate(start.getDate() + 3);
        end.setHours(23, 59, 59, 999);
    }

    if (type === "Next 7 Days") {
        start = new Date(localNow.setHours(0, 0, 0, 0));
        end = new Date(start);
        end.setDate(start.getDate() + 7);
        end.setHours(23, 59, 59, 999);
    }

    if (type === "Next 30 Days") {
        start = new Date(localNow.setHours(0, 0, 0, 0));
        end = new Date(start);
        end.setDate(start.getDate() + 30);
        end.setHours(23, 59, 59, 999);
    }


    // ------------------------
    // LAST ranges
    // ------------------------
    if (type === "Last 3 Days") {
        start = new Date(localNow);
        start.setDate(localNow.getDate() - 3);
        start.setHours(0, 0, 0, 0);

        end = new Date(localNow.setHours(23, 59, 59, 999));
    }

    if (type === "Last 7 Days") {
        start = new Date(localNow);
        start.setDate(localNow.getDate() - 7);
        start.setHours(0, 0, 0, 0);

        end = new Date(localNow.setHours(23, 59, 59, 999));
    }

    if (type === "Last 30 Days") {
        start = new Date(localNow);
        start.setDate(localNow.getDate() - 30);
        start.setHours(0, 0, 0, 0);

        end = new Date(localNow.setHours(23, 59, 59, 999));
    }


    // ------------------------
    // Custom single date (dd/mm/yyyy OR yyyy-mm-dd)
    // ------------------------
    if (type.includes("/")) {
        const [dd, mm, yyyy] = type.split("/");
        start = new Date(yyyy, mm - 1, dd, 0, 0, 0, 0);
        end = new Date(yyyy, mm - 1, dd, 23, 59, 59, 999);
    }

    if (type.includes("-")) {
        const [yyyy, mm, dd] = type.split("-");
        start = new Date(yyyy, mm - 1, dd, 0, 0, 0, 0);
        end = new Date(yyyy, mm - 1, dd, 23, 59, 59, 999);
    }

    return { start, end };
}


const cleanEmail = (raw) => {
    if (!raw) return null;
    const m = String(raw).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    return m ? m[0].toLowerCase().trim() : null;
};


const phoneEndings = (raw) => {
    // robust endings for international: last 10/9/8 of digits (drop leading 00 / 0)
    const digits = String(raw ?? "").replace(/\D+/g, "").replace(/^00/, "");
    const drop0 = digits.replace(/^0+/, "");
    const out = new Set();
    for (const s of [digits, drop0]) {
        if (s.length >= 10) out.add(s.slice(-10));
        if (s.length >= 9) out.add(s.slice(-9));
        if (s.length >= 8) out.add(s.slice(-8));
    }
    return [...out];
};



export const markJoinedFromAttendance = async (req, res) => {
    try {
        let rows = req.body;
        console.log("hit")
        console.log(req.body)
        if (!Array.isArray(rows)) rows = [rows];

        // collect unique identifiers
        const emails = new Set();
        const endings = new Set();

        for (const r of rows) {
            const em = cleanEmail(r?.email);
            if (em) emails.add(em);
            for (const e of phoneEndings(r?.phone)) endings.add(e);
        }

        if (!emails.size && !endings.size) {
            return res.json({ matchedCandidates: 0, updated: 0, reason: "No valid email/phone found" });
        }

        const BULK_STATUS = "Joined on seminar";
        const now = new Date();
        const updatedIds = new Set();
        const touched = [];

        // 1) emails: update only the LATEST per email
        for (const em of emails) {
            const latest = await lead
                .findOne({ email: em })
                .sort({ createdAt: -1, _id: -1 })
                .select("_id leadStatus")
                .lean();
            if (!latest) continue;
            if (latest.leadStatus !== BULK_STATUS && !updatedIds.has(String(latest._id))) {
                await lead.updateOne(
                    { _id: latest._id },
                    {
                        $set: { leadStatus: BULK_STATUS, lastContacted: now },
                        $push: {
                            note: {
                                text: `Auto-marked as "Joined on seminar" from attendance (${em})`,
                                createdAt: now,
                            },
                        },
                    }
                );
                updatedIds.add(String(latest._id));
                touched.push({ by: "email", key: em, id: String(latest._id) });
            }
        }

        // 2) phones (endings): update only the LATEST per ending
        for (const end of endings) {
            const latest = await lead
                .findOne({ phone: { $regex: new RegExp(`${end}$`) } })
                .sort({ createdAt: -1, _id: -1 })
                .select("_id leadStatus")
                .lean();
            if (!latest) continue;
            if (latest.leadStatus !== BULK_STATUS && !updatedIds.has(String(latest._id))) {
                await lead.updateOne(
                    { _id: latest._id },
                    {
                        $set: { leadStatus: BULK_STATUS, lastContacted: now },
                        $push: {
                            note: {
                                text: `Auto-marked as "Joined on seminar" from attendance (phone *${end})`,
                                createdAt: now,
                            },
                        },
                    }
                );
                updatedIds.add(String(latest._id));
                touched.push({ by: "phone", key: end, id: String(latest._id) });
            }
        }

        console.log([emails, endings])

        return res.json({
            matchedCandidates: emails.size + endings.size,
            updated: updatedIds.size,
            touched: touched.slice(0, 10), // sample for quick debug
        });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};



export const deleteLeads = async (req, res) => {
    try {
        // Expect: { ids: ["64f...", "650...", ...] }
        const { ids } = req.body;

        console.log(ids)

        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: "ids (non-empty array) is required" });
        }

        // Deduplicate + validate ObjectIds
        const uniqueIds = [...new Set(ids.map(String))];
        const validIds = uniqueIds.filter(mongoose.isValidObjectId);
        const invalidIds = uniqueIds.filter(id => !mongoose.isValidObjectId(id));

        console.log(validIds, "validids")

        if (validIds.length === 0) {
            return res.status(400).json({ error: "No valid MongoDB ObjectIds provided", invalidIds });
        }

        // Perform deletion
        const result = await lead.deleteMany({ _id: { $in: validIds } });

        return res.json({
            ok: true,
            requested: uniqueIds.length,
            attempted: validIds.length,
            deletedCount: result.deletedCount || 0,
            invalidIds,
        });
    } catch (error) {
        console.error("deleteLeads error:", error);
        return res.status(500).json({ error: error.message });
    }
};
