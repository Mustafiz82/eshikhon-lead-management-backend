import mongoose from "mongoose";
import lead from "../models/lead.js";
import course from "../models/course.js";
import user from "../models/user.js";
import axios from "axios";

export const createLead = async (req, res) => {
  try {
    let leads = Array.isArray(req.body) ? req.body : [req.body];

    // Helper to extract course names
    const getCourseNames = (l) => {
      if (Array.isArray(l.courses) && l.courses.length > 0) {
        return l.courses.map((c) => c.courseName?.trim()).filter(Boolean);
      }
      if (l.interstedCourse) {
        return [l.interstedCourse.trim()];
      }
      return ["not provided"];
    };

    // Step 1️⃣ — Normalize phone and orderNumber
    leads = leads.map((l) => ({
      ...l,
      phone: String(l.phone || "").trim(),
      orderNumber: l.orderNumber ? Number(l.orderNumber) : null,
    }));

    if (leads.length === 0) {
      return res.status(400).json({ error: "No leads provided" });
    }

    const duplicatesInPayload = [];
    const duplicatesInDB = [];
    const uniqueIncoming = [];

    // Step 2️⃣ — Remove duplicates inside the SAME upload payload
    const seenPairs = new Set();
    const seenOrderNumbers = new Set(); // Track seen order numbers in payload

    for (const l of leads) {
      const courseNames = getCourseNames(l);
      let isPayloadDuplicate = false;

      // Check Phone + Course pair
      for (const name of courseNames) {
        const key = `${l.phone}__${name.toLowerCase()}`;
        if (seenPairs.has(key)) {
          isPayloadDuplicate = true;
          break;
        }
      }

      // Check Order Number uniqueness in payload
      if (l.orderNumber && seenOrderNumbers.has(l.orderNumber)) {
        isPayloadDuplicate = true;
      }

      if (isPayloadDuplicate) {
        duplicatesInPayload.push(l);
      } else {
        for (const name of courseNames) {
          seenPairs.add(`${l.phone}__${name.toLowerCase()}`);
        }
        if (l.orderNumber) {
          seenOrderNumbers.add(l.orderNumber);
        }
        uniqueIncoming.push(l);
      }
    }

    // Step 3️⃣ — Find which unique candidates ALREADY exist in DB
    let existingPairs = new Set();
    let existingOrderNumbers = new Set(); // Track existing order numbers in DB

    if (uniqueIncoming.length > 0) {
      const incomingOrderNumbers = uniqueIncoming
        .map((l) => l.orderNumber)
        .filter(Boolean);

      // Conditions for Phone + Course matching
      const dbConditions = uniqueIncoming.map((l) => {
        const courseNames = getCourseNames(l);
        return {
          phone: l.phone,
          $or: [
            { "courses.courseName": { $in: courseNames } },
            { interstedCourse: { $in: courseNames } },
          ],
        };
      });

      // Combined query: check Phone+Course OR OrderNumber
      const mongoQuery = [...dbConditions];
      if (incomingOrderNumbers.length > 0) {
        mongoQuery.push({ orderNumber: { $in: incomingOrderNumbers } });
      }

      const existing = await lead
        .find(
          { $or: mongoQuery },
          { phone: 1, interstedCourse: 1, courses: 1, orderNumber: 1 },
        )
        .lean();

      existing.forEach((e) => {
        // Collect DB order numbers
        if (e.orderNumber) {
          existingOrderNumbers.add(Number(e.orderNumber));
        }

        // Collect DB Phone + Course pairs
        if (e.interstedCourse) {
          existingPairs.add(
            `${e.phone}__${e.interstedCourse.trim().toLowerCase()}`,
          );
        }
        if (Array.isArray(e.courses)) {
          e.courses.forEach((c) => {
            if (c.courseName) {
              existingPairs.add(
                `${e.phone}__${c.courseName.trim().toLowerCase()}`,
              );
            }
          });
        }
      });
    }

    // Step 4️⃣ — Separate New Leads from DB Duplicates
    const newLeads = [];

    for (const l of uniqueIncoming) {
      const courseNames = getCourseNames(l);

      const isCourseDuplicate = courseNames.some((name) =>
        existingPairs.has(`${l.phone}__${name.toLowerCase()}`),
      );

      // Check if order number already exists in DB
      const isOrderDuplicate = Boolean(
        l.orderNumber && existingOrderNumbers.has(l.orderNumber),
      );

      if (isCourseDuplicate || isOrderDuplicate) {
        duplicatesInDB.push(l);
      } else {
        newLeads.push(l);
      }
    }

    // Step 5️⃣ — Insert unique leads (using { ordered: false } to continue on errors)
    let inserted = [];
    const failedInsertions = [];

    if (newLeads.length > 0) {
      try {
        inserted = await lead.insertMany(newLeads, { ordered: false });
      } catch (insertError) {
        // Collect docs successfully inserted despite errors
        if (insertError.insertedDocs) {
          inserted = insertError.insertedDocs;
        }

        // Collect write/validation errors
        if (insertError.writeErrors && Array.isArray(insertError.writeErrors)) {
          insertError.writeErrors.forEach((we) => {
            const failedLead = newLeads[we.index];
            if (failedLead) {
              failedInsertions.push({
                phone: failedLead.phone || "N/A",
                reason: `DB Error: ${we.errmsg || insertError.message}`,
                data: failedLead,
              });
            }
          });
        } else {
          // Generic fallback for uninserted leads
          const insertedPhoneSet = new Set(
            inserted.map((i) => String(i.phone)),
          );
          newLeads.forEach((l) => {
            if (!insertedPhoneSet.has(String(l.phone))) {
              failedInsertions.push({
                phone: l.phone || "N/A",
                reason: insertError.message || "Insertion failed",
                data: l,
              });
            }
          });
        }
      }
    }

    // Step 6️⃣ — Consolidate ALL non-inserted leads into a detailed log array
    const notInsertedLeads = [
      ...duplicatesInPayload.map((l) => ({
        phone: l.phone || "N/A",
        reason: "Duplicate in upload payload",
        data: l,
      })),
      ...duplicatesInDB.map((l) => ({
        phone: l.phone || "N/A",
        reason: "Already exists in database (Phone+Course or Order Number)",
        data: l,
      })),
      ...failedInsertions,
    ];

    const totalSkipped = notInsertedLeads.length;

    // Step 7️⃣ — Return response with full logs
    return res.status(201).json({
      ok: inserted.length > 0,
      message: `${inserted.length} new leads added, ${totalSkipped} skipped/failed.`,
      insertedCount: inserted.length,
      skippedCount: totalSkipped,
      notInsertedLeads, // 👈 Detailed logs of ALL non-inserted leads with phone & data
      insertedLeads: inserted, // 👈 Array of successfully inserted lead documents
      duplicatesInPayload,
      duplicatesInDB,
      failedInsertions,
    });
  } catch (error) {
    console.error("createLead error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const createSingleLead = async (req, res) => {
  console.log(req.body);
  try {
    const result = await lead.insertOne(req.body);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const updateSingleCreatedLead = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await lead.findByIdAndUpdate(id, req.body, {
      new: true, // return updated document
      runValidators: true, // apply schema validation
    });

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
};

export const getAllLeads = async (req, res) => {
  try {
    console.log("hit");

    const {
      status,
      course,
      courseType,
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
      paymentMode,
      assignStartDate,
      assignEndDate,
      paymentStartDate,
      paymentEndDate,
      showOnlyFollowups,
      followUpDate,
      showOnlyMissedFollowUps,
      showOnlyMissedPayments,
      fields,
      lock,
      leadSource,
      upcomingPaymentsDate,
      missedFollowUpDate,
    } = req.query;

    const assignStartDateFormat = new Date(assignStartDate);
    const assignEndDateFormat = new Date(assignEndDate);
    const paymentStartDateFormat = new Date(paymentStartDate);

    const paymentEndDateFormat = new Date(paymentEndDate);
    if (paymentEndDateFormat.getUTCHours() === 18) {
      paymentEndDateFormat.setUTCDate(paymentEndDateFormat.getUTCDate() + 1);
      paymentEndDateFormat.setUTCHours(17, 59, 59, 999);
    } else {
      paymentEndDateFormat.setUTCHours(23, 59, 59, 999);
    }

    const filter = {};
    let sortOption;

    if (status && status !== "All") {
      filter.assignStatus = status;
    }

    // Build one combined $elemMatch on courses[] — course/courseType AND
    // payment-date now both need to constrain the SAME course array,
    // so they must live inside a single $elemMatch object, not two
    // separate assignments to filter.courses (the second would clobber the first)
    const courseElemMatch = {};

    if (course && course !== "All") {
      courseElemMatch.courseName = course;
    }
    if (courseType && courseType !== "All") {
      courseElemMatch.courseType = courseType;
    }

    if (paymentStartDate && paymentEndDate && paymentMode == "DateRange") {
      courseElemMatch.history = {
        $elemMatch: {
          date: {
            $gte: paymentStartDateFormat,
            $lte: paymentEndDateFormat,
          },
        },
      };
    }

    if (Object.keys(courseElemMatch).length > 0) {
      filter.courses = { $elemMatch: courseElemMatch };
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        {
          $expr: {
            $regexMatch: {
              input: { $toString: "$orderNumber" },
              regex: search,
              options: "i",
            },
          },
        },
        {
          $expr: {
            $regexMatch: {
              input: { $toString: "$_id" }, // Change "_id" to "leadId" if it is a separate field
              regex: search,
              options: "i",
            },
          },
        },
      ];
    }

    if (assignTo && assignTo !== "All") {
      filter.assignTo = assignTo;
    }

    if (createdBy) {
      filter.createdBy = createdBy;
    }

    if (leadStatus && leadStatus !== "All") {
      if (leadStatus == "Contacted") {
        filter.leadStatus = { $ne: "Pending" };
      } else {
        filter.leadStatus = leadStatus;
      }
    }

    if (interstedSeminar && interstedSeminar !== "All") {
      filter.interstedSeminar = interstedSeminar;
    }

    if (stage && stage !== "All") {
      if (stage == "Pending") filter.leadStatus = stage;
      else filter.leadStatus = { $ne: "Pending" };
    }

    if (assignStartDate && assignEndDate) {
      filter.assignDate = {
        $gte: assignStartDateFormat,
        $lte: assignEndDateFormat,
      };
    }
    console.log({ paymentStartDateFormat, paymentEndDateFormat });

    if (showOnlyFollowups === "true") {
      filter.followUpDate = { $exists: true, $ne: null };
    }

    if (followUpDate && followUpDate !== "All") {
      const { start, end } = getDateRange(followUpDate, "followup");
      if (start && end) filter.followUpDate = { $gte: start, $lte: end };
    }

    if (upcomingPaymentsDate && upcomingPaymentsDate !== "None") {
      if (upcomingPaymentsDate === "All") {
        const now = new Date();
        const localNow = new Date(
          now.toLocaleString("en-US", { timeZone: "Asia/Dhaka" }),
        );
        const startOfToday = new Date(localNow.setHours(0, 0, 0, 0));

        filter.nextEstimatedPaymentDate = {
          $exists: true,
          $gte: startOfToday,
        };
      } else {
        const { start, end } = getDateRange(upcomingPaymentsDate, "followup");
        if (start && end) {
          filter.nextEstimatedPaymentDate = { $gte: start, $lte: end };
        }
      }
    }

    if (showOnlyMissedFollowUps === "true") {
      const now = new Date();
      const bdNow = new Date(
        now.toLocaleString("en-US", { timeZone: "Asia/Dhaka" }),
      );

      filter.followUpDate = {
        $exists: true,
        $ne: null,
        $lt: bdNow,
      };
    }

    if (showOnlyMissedPayments === "true") {
      const now = new Date();
      const bdNow = new Date(
        now.toLocaleString("en-US", { timeZone: "Asia/Dhaka" }),
      );

      filter.nextEstimatedPaymentDate = {
        $exists: true,
        $ne: null,
        $lt: bdNow,
      };
    }

    if (lock && lock !== "All") {
      filter.isLocked = lock == "Locked" ? true : false;
    }

    if (leadSource && leadSource !== "All") {
      filter.leadSource = leadSource;
    }

    if (sort === "Ascending") {
      sortOption = { createdAt: 1, _id: 1 };
    } else if (sort === "Descending") {
      sortOption = { createdAt: -1, _id: -1 };
    } else if (sort === "Last Modified") {
      sortOption = { updatedAt: -1, _id: -1 };
    } else {
      sortOption = { createdAt: -1, _id: -1 };
    }

    let projection = null;
    if (fields === "table") {
      projection =
        "_id name email phone address interstedCourse leadStatus assignStatus createdAt isLocked interstedCourseType courses";
    }

    console.log(filter);

    const skip = (limit ? limit : 50) * ((currentPage ? currentPage : 1) - 1);

    const leadRes = await lead
      .find(filter, projection)
      .sort(sortOption)
      .allowDiskUse()
      .skip(skip)
      .limit(limit ? limit : 50)
      .lean();

    res.status(200).json(leadRes);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// 4370673  buy one get one
// 4374122  with discoutn applied
// 4374060  1 person 3 order

// controllers/orderController.js

export const getOrderDetails = async (req, res) => {
  const { phone } = req.query;
  console.log(phone);
  const orderNumber = req.params.id;

  if (!phone || typeof phone !== "string") {
    return res.status(400).json({
      success: false,
      message: "Phone query parameter is required.",
    });
  }

  try {
    // Check current user's role
    const currentUser = await user
      .findOne({ email: req.user.email.toLowerCase() }, { role: 1 })
      .lean();

    const isAdmin =
      currentUser?.role === "admin" || currentUser?.role === "manager";

    // 0. Prevent duplicate order unless admin is just checking
    if (orderNumber && !isAdmin) {
      const query = { orderNumber: Number(orderNumber) };
      if (req.query.leadId) {
        query._id = { $ne: req.query.leadId }; // 👈 Ignores the current lead ID!
      }

      const existingOrder = await lead.findOne(query).lean();

      if (existingOrder) {
        // 🚨 LOG MATCHED LEAD _ID TO TERMINAL
        console.log("==========================================");
        console.log("❌ ORDER NUMBER ALREADY EXISTS IN DB");
        console.log("Order Number Searched:", orderNumber);
        console.log("MATCHED LEAD _id:", existingOrder._id);
        console.log("Matched Lead Name:", existingOrder.name || "N/A");
        console.log("Matched Lead Phone:", existingOrder.phone || "N/A");
        console.log("==========================================");

        return res.status(400).json({
          success: false,
          message: `Order #${orderNumber} is used by Lead ID: ${existingOrder._id}`,
          matchedLeadId: existingOrder._id,
          isUsed: true,
        });
      }
    }

    // Fetch WooCommerce order
    const credentials = Buffer.from(
      `${process.env.WC_KEY}:${process.env.WC_SECRET}`,
    ).toString("base64");

    const response = await axios.get(
      `https://eshikhon.com.bd/wp-json/wc/v3/orders/${orderNumber}`,
      {
        headers: {
          Authorization: `Basic ${credentials}`,
        },
      },
    );

    const order = response.data;

    // return  res.status(404).json(order) ;

    

    // Normal users can only view their own orders
    if (!isAdmin) {
      const orderPhone = order.billing?.phone?.toLowerCase() || "";

      console.log(orderPhone);

      if (orderPhone.includes()) {
        return res.status(403).json({
          success: false,
          message: "This order does not belong to this customer.",
        });
      }
    }

    if (!order.line_items?.length) {
      return res.status(404).json({
        message: "No courses found in this order",
      });
    }

    const courses = order.line_items
      .map((item) => {
        const rawName = item.name;
        const cleanedName = rawName.replace(/\s*\(.*?\)\s*/g, "").trim();

        let type = "Online";
        if (rawName.toLowerCase().includes("offline course")) type = "Offline";
        else if (rawName.toLowerCase().includes("video course"))
          type = "Video Course";
        else if (rawName.toLowerCase().includes("download link"))
          type = "Download Course";

        const originalPrice = parseFloat(item.subtotal || "0");
        const total = parseFloat(item.total || "0");
        const discount = Math.max(originalPrice - total, 0);

        return {
          courseName: rawName,
          cleanedName,
          type,
          originalPrice,
          discount,
          total,
        };
      })
      .filter((c) => c.type !== "Video Course");

    res.json({
      status: order.status,
      customerPhone: order.billing?.phone || "",
      orderCompletionDate: order.date_completed ,
      ordercreationDate: order.date_created,
      courses,
    });
  } catch (error) {
    console.error(error);

    if (error.response?.status === 404) {
      return res.status(404).json({
        message: `Order #${orderNumber} not found.`,
      });
    }

    res.status(500).json({
      message: "Internal Server Error",
    });
  }
};

export const getLeadSources = async (req, res) => {
  try {
    console.log("hit /getLeadSources");

    const sources = await lead.aggregate([
      {
        $match: {
          leadSource: { $exists: true, $ne: null, $ne: "" },
        },
      },
      {
        $group: {
          _id: "$leadSource",
        },
      },
      {
        $project: {
          _id: 0,
          leadSource: "$_id",
        },
      },
    ]);

    // Extract array of strings
    const uniqueSources = sources.map((item) => item.leadSource);

    res.status(200).json(uniqueSources);
  } catch (error) {
    console.error("Error fetching lead sources:", error);
    res.status(500).json({ error: error.message });
  }
};
export const getInterestedCourses = async (req, res) => {
  try {
    console.log("hit /getInterestedCourses");

    const { agentEmail } = req.query;

    // Filter leads that have at least one course in the array
    const leadMatch = {
      "courses.courseName": {
        $exists: true,
        $nin: [null, "", "not provided", "Not Provided"],
      },
    };

    // Filter only leads assigned to this agent
    if (agentEmail) {
      leadMatch.assignTo = agentEmail.toLowerCase();
    }

    const [leadCourses, dbCourses] = await Promise.all([
      lead.aggregate([
        // Step 1: Match leads matching agent and containing course data
        {
          $match: leadMatch,
        },
        // Step 2: Unwind the courses array
        {
          $unwind: "$courses",
        },
        // Step 3: Match valid courseName inside unwound array elements
        {
          $match: {
            "courses.courseName": {
              $exists: true,
              $nin: [null, "", "not provided", "Not Provided"],
            },
          },
        },
        // Step 4: Group by unique courseName
        {
          $group: {
            _id: "$courses.courseName",
          },
        },
        // Step 5: Format output to match { name: "Course Name" }
        {
          $project: {
            _id: 0,
            name: "$_id",
          },
        },
      ]),

      // Fetch master courses list from Course model
      course.find({}, { name: 1, _id: 0 }),
    ]);

    const leadCourseNames = leadCourses
      .map((item) => item.name)
      .filter(Boolean);
    const dbCourseNames = dbCourses.map((item) => item.name).filter(Boolean);

    // Merge and remove duplicates
    const uniqueCourses = [...new Set([...leadCourseNames, ...dbCourseNames])];

    // Sort alphabetically
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
      sort, // Added to mirror getAllLeads destructuring
      interstedSeminar,
      limit, // Added to mirror getAllLeads destructuring
      currentPage, // Added to mirror getAllLeads destructuring
      createdBy,
      assignTo,
      leadStatus,
      stage,
      assignDate,
      paymentMode,
      assignStartDate,
      assignEndDate,
      paymentStartDate,
      paymentEndDate,
      showOnlyFollowups,
      followUpDate,
      showOnlyMissedFollowUps,
      showOnlyMissedPayments, // Added to mirror getAllLeads destructuring
      fields, // Added to mirror getAllLeads destructuring
      lock,
      leadSource,
      upcomingPaymentsDate,
      missedFollowUpDate,
    } = req.query;

    const filter = {};
    const assignStartDateFormat = new Date(assignStartDate);
    const assignEndDateFormat = new Date(assignEndDate);
    const paymentStartDateFormat = new Date(paymentStartDate);
    const paymentEndDateFormat = new Date(paymentEndDate);

    // NOTE: Mirrored from getAllLeads to fix midnight Bangladesh Standard Time (18:00 UTC) adjustments
    if (paymentEndDateFormat.getUTCHours() === 18) {
      paymentEndDateFormat.setUTCDate(paymentEndDateFormat.getUTCDate() + 1);
      paymentEndDateFormat.setUTCHours(17, 59, 59, 999);
    } else {
      // Fallback for UTC midnight
      paymentEndDateFormat.setUTCHours(23, 59, 59, 999);
    }

    // 1. Status
    if (status && status !== "All") {
      filter.assignStatus = status;
    }

    // 2. Course
    if (course && course !== "All") {
      filter["courses.courseName"] = course;
    }

    // 3. Search
    /* Old Search logic commented out to mirror getAllLeads (which includes orderNumber search)
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }
    */
    // Mirrored search logic from getAllLeads (adds orderNumber regex string-cast search matching)
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        {
          $expr: {
            $regexMatch: {
              input: { $toString: "$orderNumber" },
              regex: search,
              options: "i",
            },
          },
        },
      ];
    }

    // 4. AssignTo
    if (assignTo && assignTo !== "All") {
      filter.assignTo = assignTo;
    }

    // 5. CreatedBy
    if (createdBy) {
      filter.createdBy = createdBy;
    }

    // 6. LeadStatus
    /* Old LeadStatus logic commented out to mirror special "Contacted" treatment in getAllLeads
    if (leadStatus && leadStatus !== "All") {
      filter.leadStatus = leadStatus;
    }
    */
    // Mirrored LeadStatus logic from getAllLeads (adds special "Contacted" status support)
    if (leadStatus && leadStatus !== "All") {
      if (leadStatus == "Contacted") {
        filter.leadStatus = { $ne: "Pending" };
      } else {
        filter.leadStatus = leadStatus;
      }
    }

    // 7. Seminar
    if (interstedSeminar && interstedSeminar !== "All") {
      filter.interstedSeminar = interstedSeminar;
    }

    // 8. Stage
    if (stage && stage !== "All") {
      if (stage === "Pending") filter.leadStatus = stage;
      else filter.leadStatus = { $ne: "Pending" };
    }

    // 9. AssignDate
    if (assignStartDate && assignEndDate) {
      // const { start, end } = getDateRange(assignDate, "assign");
      filter.assignDate = {
        $gte: assignStartDateFormat,
        $lte: assignEndDateFormat,
      };
    }

    if (paymentStartDate && paymentEndDate && paymentMode == "DateRange") {
      filter.history = {
        $elemMatch: {
          date: {
            $gte: paymentStartDateFormat,
            $lte: paymentEndDateFormat,
          },
        },
      };
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

    // 12. Upcoming Payments
    if (upcomingPaymentsDate && upcomingPaymentsDate !== "None") {
      if (upcomingPaymentsDate === "All") {
        const now = new Date();
        const localNow = new Date(
          now.toLocaleString("en-US", { timeZone: "Asia/Dhaka" }),
        );
        const startOfToday = new Date(localNow.setHours(0, 0, 0, 0));

        filter.nextEstimatedPaymentDate = {
          $exists: true,
          $gte: startOfToday,
        };
      } else {
        const { start, end } = getDateRange(upcomingPaymentsDate, "followup");
        if (start && end) {
          filter.nextEstimatedPaymentDate = { $gte: start, $lte: end };
        }
      }
    }

    // 13. Missed Follow Ups Boolean
    /* Old Missed Follow Ups logic commented out to mirror overwriting behavior of getAllLeads
    if (showOnlyMissedFollowUps === "true") {
      const now = new Date();
      const bdNow = new Date(
        now.toLocaleString("en-US", { timeZone: "Asia/Dhaka" }),
      );

      // Use spread to merge if followUpDate already exists from previous filters
      filter.followUpDate = {
        ...filter.followUpDate,
        $exists: true,
        $ne: null,
        $lt: bdNow,
      };
    }
    */
    // Mirrored Missed Follow Ups logic from getAllLeads
    if (showOnlyMissedFollowUps === "true") {
      const now = new Date();
      const bdNow = new Date(
        now.toLocaleString("en-US", { timeZone: "Asia/Dhaka" }),
      );

      filter.followUpDate = {
        $exists: true,
        $ne: null,
        $lt: bdNow, // strictly before current date-time
      };
    }

    // 13b. Missed Payments Boolean (Added to mirror getAllLeads)
    if (showOnlyMissedPayments === "true") {
      const now = new Date();
      const bdNow = new Date(
        now.toLocaleString("en-US", { timeZone: "Asia/Dhaka" }),
      );

      filter.nextEstimatedPaymentDate = {
        $exists: true,
        $ne: null,
        $lt: bdNow, // strictly before current date-time
      };
    }

    // 14. Missed Follow Up Date
    // NOTE: Commented out to mirror getAllLeads, which has this filter commented out.
    /*
    if (missedFollowUpDate && missedFollowUpDate !== "All") {
      const { start, end } = getDateRange(missedFollowUpDate, "missedFollowup");
      const now = new Date();
      const bdNow = new Date(
        now.toLocaleString("en-US", { timeZone: "Asia/Dhaka" }),
      );

      filter.followUpDate = {
        ...filter.followUpDate,
        $exists: true,
        $ne: null,
        $lt: bdNow,
        ...(start && end ? { $gte: start, $lte: end } : {}),
      };
    }
    */

    // 15. Lock
    if (lock && lock !== "All") {
      filter.isLocked = lock == "Locked" ? true : false;
    }

    // 16. Lead Source
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
      { runValidators: true },
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
    const { id } = req.params;
    const data = req.body;

    const updates = { ...data };

    const leadDoc = await lead.findById(id);
    if (!leadDoc) return res.status(404).json({ message: "Lead not found" });

    const currentUser = updates.lastModifiedBy || "Unknown User";

    // 1. IGNORE LIST (Removed "courses" from ignore list so we can track course changes)
    const ignoredFields = [
      "_id",
      "createdAt",
      "updatedAt",
      "__v",
      "history",
      "note",

      "lastModifiedBy",
      "enrolledAt",
      "sourceFileName",
      "totalPaid",
      "totalDue",
      "paidAmount",
      "paymentDate",
      "refundAmount",
      "discountUnit",
      "originalPrice",
      "leadDiscount",
      "discountedPrice",
      "discountSource",
      "courses", // <--- Handled separately below
    ];

    // ALL Date fields in schema
    const dateFields = [
      "followUpDate",
      "assignDate",
      "nextEstimatedPaymentDate",
      "firstContacted",
      "lastContacted",
      "enrolledAt",
    ];

    // Helper to safely compare dates
    const normalizeDate = (val) => {
      if (!val) return null;
      const d = new Date(val);
      return isNaN(d.getTime()) ? null : d.toISOString().split("T")[0]; // compares YYYY-MM-DD
    };

    // 2. DETECT STANDARD & DATE FIELD CHANGES
    const changedFields = {};
    for (const key in updates) {
      if (ignoredFields.includes(key)) continue;

      const oldValue = leadDoc[key];
      const newValue = updates[key];

      // Robust Date Comparison for ALL date fields
      if (dateFields.includes(key)) {
        const d1 = normalizeDate(oldValue);
        const d2 = normalizeDate(newValue);

        if (d1 !== d2) {
          changedFields[key] = { old: d1 || "Not Set", new: d2 || "Not Set" };
        }
        continue;
      }

      // Standard Field Comparison
      if (newValue !== undefined && oldValue != newValue) {
        changedFields[key] = { old: oldValue, new: newValue };
      }
    }

    // ======================================================
    // 3. DETECT COURSE CHANGES
    // ======================================================
    const courseStoryParts = [];
    if (Array.isArray(updates.courses)) {
      const oldCourses = leadDoc.courses || [];
      const newCourses = updates.courses;

      // Check for added/removed/modified courses
      const oldCourseMap = new Map(
        oldCourses.map((c) => [c.courseName?.trim().toLowerCase(), c]),
      );
      const newCourseMap = new Map(
        newCourses.map((c) => [c.courseName?.trim().toLowerCase(), c]),
      );

      // Added courses
      for (const [name, newC] of newCourseMap.entries()) {
        if (!oldCourseMap.has(name)) {
          courseStoryParts.push(
            `added course "${newC.courseName}" (${newC.courseType || "Not Specified"}, Price: ${newC.originalPrice || 0})`,
          );
        } else {
          // Modified course details
          const oldC = oldCourseMap.get(name);
          const changes = [];
          if (oldC.originalPrice !== newC.originalPrice) {
            changes.push(
              `price: ${oldC.originalPrice || 0} → ${newC.originalPrice || 0}`,
            );
          }
          if (oldC.leadDiscount !== newC.leadDiscount) {
            changes.push(
              `discount: ${oldC.leadDiscount || 0} → ${newC.leadDiscount || 0}`,
            );
          }
          if (oldC.courseType !== newC.courseType) {
            changes.push(`type: "${oldC.courseType}" → "${newC.courseType}"`);
          }
          if (changes.length > 0) {
            courseStoryParts.push(
              `updated course "${newC.courseName}" (${changes.join(", ")})`,
            );
          }
        }
      }

      // Removed courses
      for (const [name, oldC] of oldCourseMap.entries()) {
        if (!newCourseMap.has(name)) {
          courseStoryParts.push(`removed course "${oldC.courseName}"`);
        }
      }
    }

    // ======================================================
    // 4. STORY FRAGMENTS ACCUMULATOR
    // ======================================================
    const storyParts = [];
    const handledKeys = new Set();

    // SCENARIO A: ENROLLMENT
    if (changedFields["leadStatus"] && updates.leadStatus === "Enrolled") {
      const firstCourse = updates.courses?.[0] || leadDoc.courses?.[0];
      const price = updates.discountedPrice || firstCourse?.originalPrice || 0;
      const paid = Number(updates.paidAmount) || 0;
      const due = updates.nextEstimatedPaymentDate
        ? normalizeDate(updates.nextEstimatedPaymentDate)
        : "N/A";

      storyParts.push(
        `enrolled the student (Price: ${price}, Paid: ${paid}, Next Due: ${due})`,
      );

      const enrollmentFields = [
        "leadStatus",
        "originalPrice",
        "discountedPrice",
        "leadDiscount",
        "discountSource",
        "nextEstimatedPaymentDate",
        "enrolledAt",
        "discountUnit",
        "discountPercent",
      ];
      enrollmentFields.forEach((k) => handledKeys.add(k));
    }

    // SCENARIO B: REFUND
    else if (changedFields["leadStatus"] && updates.leadStatus === "Refunded") {
      const refAmt = updates.refundAmount || 0;
      storyParts.push(
        `marked lead as Refunded and processed refund of ${refAmt}`,
      );
      handledKeys.add("leadStatus");
      handledKeys.add("refundAmount");
    }

    // SCENARIO C: PAYMENT ONLY
    const incomingPayment = Number(updates.paidAmount);
    if (incomingPayment > 0 && updates.leadStatus !== "Enrolled") {
      storyParts.push(`received a payment of ${incomingPayment}`);
    }

    // SCENARIO D: STATUS + FOLLOW UP
    if (changedFields["leadStatus"] && changedFields["followUpDate"]) {
      const newStatus = changedFields["leadStatus"].new;
      const newDate = changedFields["followUpDate"].new;
      const oldDate = changedFields["followUpDate"].old;

      if (newDate && newDate !== "Not Set") {
        storyParts.push(
          `changed status to "${newStatus}" and set follow-up for ${newDate}`,
        );
      } else if (oldDate) {
        storyParts.push(
          `changed status to "${newStatus}" and cleared follow-up date`,
        );
      } else {
        storyParts.push(`changed status to "${newStatus}"`);
      }

      handledKeys.add("leadStatus");
      handledKeys.add("followUpDate");
    }

    // Add Course changes into story
    if (courseStoryParts.length > 0) {
      storyParts.push(...courseStoryParts);
    }

    // SCENARIO E: LEFTOVERS
    for (const key in changedFields) {
      if (handledKeys.has(key)) continue;

      const { old: oldVal, new: newVal } = changedFields[key];
      const readableKey = key.replace(/([A-Z])/g, " $1").trim();

      if (!newVal || newVal === "Not Set") {
        if (oldVal && oldVal !== "Not Set") {
          storyParts.push(`cleared ${readableKey}`);
        }
      } else if (!oldVal || oldVal === "Not Set") {
        storyParts.push(`set ${readableKey} to "${newVal}"`);
      } else {
        storyParts.push(
          `changed ${readableKey} from "${oldVal}" to "${newVal}"`,
        );
      }
    }

    // ======================================================
    // 5. GENERATE THE SINGLE NOTE
    // ======================================================
    if (storyParts.length > 0) {
      const finalMessage = `${storyParts.join(".\n\n")}.`;
      leadDoc.note.push({
        text: finalMessage,
        by: currentUser,
      });
    }

    // ======================================================
    // 6. APPLY UPDATES TO DB
    // ======================================================
    for (const key in updates) {
      if (key === "note" || key === "paidAmount") continue;
      leadDoc[key] = updates[key];
    }

    if (incomingPayment > 0) {
      const isFirstPayment =
        !Array.isArray(leadDoc.history) || leadDoc.history.length === 0;

      const txDate =
        isFirstPayment && updates.orderCompletionDate
          ? new Date(updates.orderCompletionDate)
          : new Date();

      const paymentEntry = {
        paidAmount: incomingPayment,
        date: txDate,
      };

      leadDoc.totalPaid = (leadDoc.totalPaid || 0) + incomingPayment;
      leadDoc.history.push(paymentEntry);
    }

    if (updates.note && updates.note.length > 0) {
      const manualNotes = updates.note.map((n) => ({
        text: typeof n === "string" ? n : n.text,
        by: currentUser,
      }));
      leadDoc.note.push(...manualNotes);
    }

    const savedLead = await leadDoc.save();
    res.json(savedLead);
  } catch (e) {
    console.error("Update Lead Error:", e);
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
    const day = localNow.getDay(); // 0=Sunday … 6=Saturday
    const diff = (day + 1) % 7; // Saturday = 0
    start = new Date(localNow);
    start.setDate(localNow.getDate() - diff);
    start.setHours(0, 0, 0, 0);

    end = new Date(start);
    end.setDate(start.getDate() + 6); // Friday
    end.setHours(23, 59, 59, 999);
  }

  if (type === "This Month") {
    start = new Date(localNow.getFullYear(), localNow.getMonth(), 1);
    end = new Date(
      localNow.getFullYear(),
      localNow.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );
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
  const digits = String(raw ?? "")
    .replace(/\D+/g, "")
    .replace(/^00/, "");
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
    console.log("hit");
    console.log(req.body);
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
      return res.json({
        matchedCandidates: 0,
        updated: 0,
        reason: "No valid email/phone found",
      });
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
      if (
        latest.leadStatus !== BULK_STATUS &&
        !updatedIds.has(String(latest._id))
      ) {
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
          },
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
      if (
        latest.leadStatus !== BULK_STATUS &&
        !updatedIds.has(String(latest._id))
      ) {
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
          },
        );
        updatedIds.add(String(latest._id));
        touched.push({ by: "phone", key: end, id: String(latest._id) });
      }
    }

    console.log([emails, endings]);

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

    console.log(ids);

    if (!Array.isArray(ids) || ids.length === 0) {
      return res
        .status(400)
        .json({ error: "ids (non-empty array) is required" });
    }

    // Deduplicate + validate ObjectIds
    const uniqueIds = [...new Set(ids.map(String))];
    const validIds = uniqueIds.filter(mongoose.isValidObjectId);
    const invalidIds = uniqueIds.filter((id) => !mongoose.isValidObjectId(id));

    console.log(validIds, "validids");

    if (validIds.length === 0) {
      return res
        .status(400)
        .json({ error: "No valid MongoDB ObjectIds provided", invalidIds });
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

export const handleOrderCreatedWebhook = (req, res) => {
  // Print the incoming request body to your terminal
  console.log("Webhook Payload Received:", req.body);

  // Send a 200 OK response back to WooCommerce immediately
  return res.sendStatus(200);
};
