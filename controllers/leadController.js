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



export const getAllLeads = async (req , res) => {
    try {
        const leadRes = await lead.find().limit(50)
        res.status(200).json(leadRes)
    } catch (error) {
        res.status(400).json({error :error.message})
    }
}
