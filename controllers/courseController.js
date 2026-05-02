import course from "../models/course.js";

/** Create */
export const createCource = async (req, res) => {
  try {
    console.log(req.body);
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
    if (!cource) return res.status(404).json({ error: "course not    found" });
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
    const allowed = ["name", "type", "regularPrice" , "price", "code"];
    const payload = Object.fromEntries(
      Object.entries(req.body || {}).filter(([k]) => allowed.includes(k)),
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


const normalize = (v) =>
  v?.toString().trim().replace(/\s+/g, " ").toLowerCase();

export const syncCourse = async (req, res) => {
  try {
    const response = await fetch(
      `${process.env.SHEET_API_URL}?key=${process.env.PRICE_SHEET_KEY}`
    );

    const sheetData = await response.json();
    const dbCourses = await course.find({});

    // 🔥 KEY = name + type (FIXED)
    const dbMap = new Map();
    const sheetMap = new Map();

    dbCourses.forEach((c) => {
      const key = `${normalize(c.name)}__${normalize(c.type)}`;
      dbMap.set(key, c);
    });

    sheetData.forEach((s) => {
      const key = `${normalize(s.name)}__${normalize(s.type)}`;
      sheetMap.set(key, s);
    });

    let changed = [];
    let added = [];
    let deleted = [];

    // 🔥 UPDATE + ADD
    for (const [key, sheetItem] of sheetMap.entries()) {
      const existing = dbMap.get(key);

      if (existing) {
        let changeObj = {
          name: existing.name,
          type: existing.type,
          code: existing.code,
        };

        let hasChange = false;

        // PRICE
        if (sheetItem.price !== existing.price) {
          changeObj.oldPrice = existing.price;
          changeObj.newPrice = sheetItem.price;
          existing.price = sheetItem.price;
          hasChange = true;
        }

        // REGULAR PRICE
        if (sheetItem.regularPrice !== existing.regularPrice) {
          changeObj.oldRegularPrice = existing.regularPrice;
          changeObj.newRegularPrice = sheetItem.regularPrice;
          existing.regularPrice = sheetItem.regularPrice;
          hasChange = true;
        }

        // CODE (allowed)
        if (sheetItem.code && sheetItem.code !== existing.code) {
          changeObj.oldCode = existing.code;
          changeObj.newCode = sheetItem.code;
          existing.code = sheetItem.code;
          hasChange = true;
        }

        if (hasChange) {
          await existing.save();
          changed.push(changeObj);
        }

      } else {
        // 🔥 NEW COURSE
        const newCourse = await course.create({
          name: sheetItem.name,
          type: sheetItem.type,
          price: sheetItem.price,
          regularPrice: sheetItem.regularPrice,
          code: sheetItem.code,
        });

        added.push({
          name: newCourse.name,
          type: newCourse.type,
          code: newCourse.code,
          price: newCourse.price,
          regularPrice: newCourse.regularPrice,
        });
      }
    }

    // 🔥 DELETE (not found in sheet)
    for (const [key, dbItem] of dbMap.entries()) {
      if (!sheetMap.has(key)) {
        await course.findByIdAndDelete(dbItem._id);

        deleted.push({
          name: dbItem.name,
          type: dbItem.type,
          code: dbItem.code,
        });
      }
    }

    return res.json({
      changedCount: changed.length,
      addedCount: added.length,
      deletedCount: deleted.length,
      changed,
      added,
      deleted
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Sync failed" });
  }
};