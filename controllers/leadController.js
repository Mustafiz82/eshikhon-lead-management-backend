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
        const sortOption = {}

        if (status !== "All") {
            filter.status = status;
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


        if (sort && sort !== "default") {
            sortOption.createdAt = sort === "Ascending" ? 1 : -1;
        }


        const skip = (limit ? limit : 50) * ((currentPage ? currentPage : 1) - 1)



        console.log(status, course, search, sort, limit, currentPage)
        const leadRes = await lead.find(filter).sort(sortOption).skip(skip).limit(limit ? limit : 50)

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
            filter.status = status;
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
