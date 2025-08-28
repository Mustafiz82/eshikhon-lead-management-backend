
import lead from "../models/lead.js"
import User from "../models/user.js"
import { compare } from "bcrypt"

export const createUser = async (req, res) => {
    try {
        const user = await User.create(req.body)
        res.status(201).json(user)
    } catch (error) {
        res.status(400).json({ error: error.message })
    }
}

export const getAllUser = async (_req, res) => {
    try {
        const users = await User.aggregate([
            {
                $lookup: {
                    from: lead.collection.name,   // "leads"
                    localField: "email",
                    foreignField: "assignTo",
                    as: "assignedLeads",
                },
            },
            {
                $addFields: {
                    leadCount: { $size: "$assignedLeads" },
                    naLeadCount: {
                        $size: {
                            $filter: {
                                input: "$assignedLeads",
                                as: "lead",
                                cond: { $eq: ["$$lead.leadStatus", "N/A"] },
                            },
                        },
                    },
                },
            },
            // keep ALL original user fields (incl. password), remove only the temp lookup array
            { $unset: "assignedLeads" },
        ]);

        return res.status(200).json(users);
    } catch (error) {
        return res.status(400).json({ error: error.message });
    }
};


export const getUser = async (req, res) => {
    const { id } = req.params
    try {
        const result = await User.findById(id)
        return res.status(200).json(result)
    } catch (error) {
        return res.status(400).json({ error: error.message })
    }
}


export const updateUser = async (req, res) => {

    const { id } = req.params
    try {
        const user = await User.findByIdAndUpdate(id, req.body, {
            new: true
        })
        return res.status(200).json({ message: "user updated successfully", data: user })
    }
    catch (error) {
        return res.status(400).json({ error: error.message })
    }
}


export const deleteUser = async (req, res) => {
    const { id } = req.params;
    try {
        const user = await User.findByIdAndDelete(id, {
            new: true
        })
        return res.status(200).json({ message: "user deleted successfully", data: user })
    }
    catch (error) {
        return res.status(200).json({ error: error.message })
    }
}


export const login = async (req, res) => {
    try {
        const { email, password } = req.body

        if (!email || !password) {
            return res.status(400).json({ error: "Email and password are required" })
        }
        // console.log(email , password)


        const user = await User.findOne({
            email: email
        }).select("+password")

        if (!user) {
            return res.status(400).json({ error: "user not found" })
        }

        const ok = await compare(password, user.password)

        if (!ok) return res.status(400).json({ error: "Invalid Credentials" })

        const { password: _, ...safe } = user.toObject();

        return res.json({ user: safe });

        // console.log( user )
    } catch (error) {
        return res.status(400).json({ error: error.message })
    }
}   