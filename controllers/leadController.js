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

        console.log(leads)
        console.log(inserted)

        return res.status(201).json({
            ok: true,
            count: inserted.length,
            data: inserted,
        });


    } catch (error) {
        res.status(400).json({ error: error.message })
    }
}



export const getAllLeads = async (req, res) => {
    try {

        const { status, course, search, sort, limit, currentPage } = req.query

        console.log(search + "ends")


        const filter = {}
        let sortOption 


        if (status !== "All") {
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

       
        if (sort === "Ascending") {
            sortOption = { createdAt: 1, _id: 1 };
        } else if (sort === "Descending") {
            sortOption = { createdAt: -1, _id: -1 };
        } else {
            // Default (stable, newest first)
            sortOption = { createdAt: -1, _id: -1 };
        }


        const skip = (limit ? limit : 50) * ((currentPage ? currentPage : 1) - 1)



        console.log(status, course, search, sort, limit, currentPage)
        const leadRes = await lead.find(filter).sort(sortOption).skip(skip).limit(limit ? limit : 50)
        console.log(leadRes)

        res.status(200).json(leadRes)
    } catch (error) {
        res.status(400).json({ error: error.message })
    }
}



export const getLeadsCount = async (req, res) => {
    try {
        const { status, course, search } = req.query;

        const filter = {};

        if (status !== "All") {
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

        const count = await lead.countDocuments(filter); // counts only filtered data

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





