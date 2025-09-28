import mongoose from "mongoose"
import lead from "../models/lead.js"


export const createLead = async (req, res) => {
    try {
        let leads = req.body
        console.log(leads)

        if (!Array.isArray(leads)) {
            leads = [leads]
        }
        const inserted = await lead.insertMany(leads);

        // console.log(leads)
        // console.log(inserted)

        return res.status(201).json({
            ok: true,
            count: inserted.length,
            data: inserted,
        });


    } catch (error) {
        res.status(400).json({ error: error.message })
    }
}


export const createSingleLead = async (req, res) => {
    console.log("hit")
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
            missedFollowUpDate } = req.query

        console.log(showOnlyFollowups, status, course, search, sort, limit, currentPage, createdBy, assignTo)

        console.log(search + "ends")


        const filter = {}
        let sortOption


        if (status && status !== "All") {
            filter.assignStatus = status;
        }

        if (course && course !== "All") {
            filter.seminarTopic = course
        }

        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
                { phone: { $regex: search, $options: "i" } },
            ]

        }

        if (assignTo && assignTo !== "null") {
            filter.assignTo = assignTo
        }

        if (createdBy) {
            filter.createdBy = createdBy
        }

        if (leadStatus && leadStatus !== "All") {
            filter.leadStatus = leadStatus
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

        if (showOnlyMissedFollowUps === "true") {
            const now = new Date();
            const bdNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Dhaka" }));

            filter.followUpDate = {
                $exists: true,
                $ne: null,
                $lt: bdNow,   // strictly before current date-time
            };
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
                "_id name email phone address seminarTopic leadStatus assignStatus createdAt";
        }


        console.log(filter)

        const skip = (limit ? limit : 50) * ((currentPage ? currentPage : 1) - 1)

        console.log(status, course, search, sort, limit, currentPage)
        const leadRes = await lead.find(filter , projection).sort(sortOption).allowDiskUse().skip(skip).limit(limit ? limit : 50).lean()
        // console.log(leadRes)

        res.status(200).json(leadRes)
    } catch (error) {
        res.status(400).json({ error: error.message })
    }
}





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
        } = req.query;

        const filter = {};

        if (status && status !== "All") {
            filter.assignStatus = status;
        }

        if (course && course !== "All") {
            filter.seminarTopic = course;
        }

        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
                { phone: { $regex: search, $options: "i" } },
            ];
        }

        if (assignTo) {
            filter.assignTo = assignTo;
        }

        if (createdBy) {
            filter.createdBy = createdBy;
        }

        if (leadStatus && leadStatus !== "All") {
            filter.leadStatus = leadStatus;
        }

        if (stage && stage !== "All") {
            if (stage === "Pending") filter.leadStatus = stage;
            else filter.leadStatus = { $ne: "Pending" };
        }

        if (assignDate && assignDate !== "All") {
            const { start, end } = getDateRange(assignDate, "assign");
            if (start && end) filter.assignDate = { $gte: start, $lte: end };
        }

        if (showOnlyFollowups === "true") {
            filter.followUpDate = { $exists: true, $ne: null };
        }

        if (followUpDate && followUpDate !== "All") {
            const { start, end } = getDateRange(followUpDate, "followup");
            if (start && end) filter.followUpDate = { $gte: start, $lte: end };
        }

        if (showOnlyMissedFollowUps === "true") {
            const now = new Date();
            const bdNow = new Date(
                now.toLocaleString("en-US", { timeZone: "Asia/Dhaka" })
            );

            filter.followUpDate = {
                $exists: true,
                $ne: null,
                $lt: bdNow, // strictly before now
            };
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
