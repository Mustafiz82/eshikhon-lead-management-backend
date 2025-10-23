import course from "../models/course.js";


/** Create */
export const createCource = async (req, res) => {
    try {

        const cource = await course.create(req.body);
        return res.status(201).json(cource);
    } catch (err) {
        // if (err.name === "ValidationError") {
        return res.status(400).json({ error: err.message });
        // }
        // return res.status(500).json({ error: "Internal server error" });
    }
};

/** List (with pagination, search, sort) */
export const listCources = async (req, res) => {
    try {
        const { page, limit, sort = "Default", q = "", type } = req.query;

        // Build filter
        const filter = {};
        if (q) filter.name = { $regex: q, $options: "i" };
        if (type) filter.type = type;

        // Define fixed sort logic
        let sortOption = {};
        switch (sort) {
            case "Name (Ascending)":
                sortOption = { name: 1 };
                break;
            case "Name (Descending)":
                sortOption = { name: -1 };
                break;
            case "Price (Ascending)":
                sortOption = { price: 1 };
                break;
            case "Price (Descending)":
                sortOption = { price: -1 };
                break;
            default:
                sortOption = { createdAt: -1 }; // Default → newest first
        }

        const hasPagination = page !== undefined && limit !== undefined;

        if (hasPagination) {
            // Pagination mode
            const pageNum = Math.max(1, Number(page));
            const lim = Math.min(100, Math.max(1, Number(limit)));
            const skip = (pageNum - 1) * lim;

            const [items, total] = await Promise.all([
                course.find(filter).sort(sortOption).skip(skip).limit(lim),
                course.countDocuments(filter),
            ]);

            return res.json({
                items,
                total,
                page: pageNum,
                pages: Math.ceil(total / lim),
                limit: lim,
            });
        }

        // Non-pagination mode
        const items = await course.find(filter).sort(sortOption);
        return res.json({ items, total: items.length });
    } catch (err) {
        return res.status(500).json({ error: "Internal server error" });
    }
};



/** Read (single) */
export const getCourceById = async (req, res) => {
    try {
        const { id } = req.params;
        const cource = await course.findById(id);
        if (!cource) return res.status(404).json({ error: "course not found" });
        return res.json(cource);
    } catch (err) {
        // invalid ObjectId, etc.
        return res.status(400).json({ error: "Invalid id" });
    }
};

/** Update (partial or full) */
export const updateCource = async (req, res) => {
    try {
        const { id } = req.params;

        // Only allow known fields
        const allowed = ["name", "type", "price"];
        const payload = Object.fromEntries(
            Object.entries(req.body || {}).filter(([k]) => allowed.includes(k))
        );

        const cource = await course.findByIdAndUpdate(id, payload, {
            new: true,
            runValidators: true, // <-- rely on Mongoose validators
        });
        if (!cource) return res.status(404).json({ error: "course not found" });
        return res.json(cource);
    } catch (err) {
        if (err.name === "ValidationError") {
            return res.status(400).json({ error: err.message });
        }
        return res.status(400).json({ error: "Invalid id or payload" });
    }
};

/** Delete (hard delete) */
export const deleteCource = async (req, res) => {
    try {
        const { id } = req.params;
        const cource = await course.findByIdAndDelete(id);
        if (!cource) return res.status(404).json({ error: "course not found" });
        return res.json({ message: "course deleted", id });
    } catch (err) {
        return res.status(400).json({ error: "Invalid id" });
    }
};
