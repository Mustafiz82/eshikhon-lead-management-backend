import fileHistory from "../models/fileHistory.js"

export const createFileName = async (req ,res) => {
    try {
        const user = await fileHistory.create(req.body)
        res.status(201).json(user)
    } catch (error) {
        res.status(400).json({error : error.message})
    }
}




export const getAllFileNames = async (req, res) => {
    try {
        const files = await fileHistory.find().sort({ date: -1 })
        return res.status(200).json(files)
    } catch (error) {
        return res.status(400).json({ error: error.message })
    }
}