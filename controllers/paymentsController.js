import commissionPayment from "../models/commissionPayment.js";
import commissionSnapshot from "../models/commissionSnapshot.js";
import lead from "../models/lead.js";
import user from "../models/user.js";

const buildCommissionPipeline = ({ email, monthKey }) => {
  const baseMatch = {};
  if (email) baseMatch.assignTo = email;

  const pipeline = [
    { $match: baseMatch },

    {
      $facet: {
        monthlyPayments: [
          { $unwind: { path: "$history", preserveNullAndEmptyArrays: false } },
          {
            $addFields: {
              paymentDateObj: { $toDate: "$history.date" },
              paidAmountD: { $toDouble: "$history.paidAmount" },
            },
          },
          {
            $addFields: {
              monthKey: {
                $dateToString: { format: "%Y-%m", date: "$paymentDateObj" },
              },
            },
          },
          {
            $group: {
              _id: { assignTo: "$assignTo", monthKey: "$monthKey" },
              totalPayments: { $sum: "$paidAmountD" },
            },
          },
        ],

        monthlyRefunds: [
          {
            $match: {
              refundAmount: { $gt: 0 },
              enrolledAt: { $exists: true, $ne: null },
            },
          },
          {
            $addFields: {
              enrolledDateObj: { $toDate: "$enrolledAt" },
              refundD: { $toDouble: { $ifNull: ["$refundAmount", 0] } },
            },
          },
          {
            $addFields: {
              monthKey: {
                $dateToString: { format: "%Y-%m", date: "$enrolledDateObj" },
              },
            },
          },
          {
            $group: {
              _id: { assignTo: "$assignTo", monthKey: "$monthKey" },
              totalRefunds: { $sum: "$refundD" },
            },
          },
        ],

        monthlyBasePrice: [
          { $match: { assignDate: { $exists: true, $ne: null } } },
          {
            $lookup: {
              from: "courses",
              let: { topic: "$interstedCourse", type: "$interstedCourseType" },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ["$name", "$$topic"] },
                        { $eq: ["$type", "$$type"] },
                      ],
                    },
                  },
                },
                { $project: { price: 1, _id: 0 } },
                { $limit: 1 },
              ],
              as: "courseData",
            },
          },
          {
            $unwind: { path: "$courseData", preserveNullAndEmptyArrays: true },
          },
          {
            $addFields: {
              effectivePrice: { $ifNull: ["$courseData.price", 0] },
              assignDateObj: { $toDate: "$assignDate" },
            },
          },
          {
            $addFields: {
              monthKey: {
                $dateToString: { format: "%Y-%m", date: "$assignDateObj" },
              },
            },
          },
          {
            $group: {
              _id: { assignTo: "$assignTo", monthKey: "$monthKey" },
              basePrice: { $sum: "$effectivePrice" },
            },
          },
        ],
      },
    },

    {
      $project: {
        merged: {
          $concatArrays: [
            {
              $map: {
                input: "$monthlyPayments",
                as: "p",
                in: {
                  assignTo: "$$p._id.assignTo",
                  monthKey: "$$p._id.monthKey",
                  totalPayments: "$$p.totalPayments",
                  totalRefunds: 0,
                  basePrice: 0,
                },
              },
            },
            {
              $map: {
                input: "$monthlyRefunds",
                as: "r",
                in: {
                  assignTo: "$$r._id.assignTo",
                  monthKey: "$$r._id.monthKey",
                  totalPayments: 0,
                  totalRefunds: "$$r.totalRefunds",
                  basePrice: 0,
                },
              },
            },
            {
              $map: {
                input: "$monthlyBasePrice",
                as: "b",
                in: {
                  assignTo: "$$b._id.assignTo",
                  monthKey: "$$b._id.monthKey",
                  totalPayments: 0,
                  totalRefunds: 0,
                  basePrice: "$$b.basePrice",
                },
              },
            },
          ],
        },
      },
    },

    { $unwind: "$merged" },

    {
      $group: {
        _id: { assignTo: "$merged.assignTo", monthKey: "$merged.monthKey" },
        totalPayments: { $sum: "$merged.totalPayments" },
        totalRefunds: { $sum: "$merged.totalRefunds" },
        basePrice: { $sum: "$merged.basePrice" },
      },
    },

    {
      $addFields: {
        totalSales: { $subtract: ["$totalPayments", "$totalRefunds"] },
      },
    },

    {
      $lookup: {
        from: user.collection.name,
        localField: "_id.assignTo",
        foreignField: "email",
        as: "userData",
      },
    },
    { $unwind: "$userData" },

    {
      $addFields: {
        agentEmail: "$_id.assignTo",
        agentName: "$userData.name",
        monthDate: {
          $dateFromString: {
            dateString: { $concat: ["$_id.monthKey", "-01"] },
          },
        },
        targetAmount: {
          $multiply: [
            "$basePrice",
            { $divide: [{ $ifNull: ["$userData.target", 0] }, 100] },
          ],
        },
      },
    },

    {
      $addFields: {
        targetCompletionRate: {
          $cond: [
            { $gt: ["$targetAmount", 0] },
            {
              $round: [
                {
                  $multiply: [
                    { $divide: ["$totalSales", "$targetAmount"] },
                    100,
                  ],
                },
                0,
              ],
            },
            0,
          ],
        },
      },
    },

    {
      $addFields: {
        commissionDue: {
          $switch: {
            branches: [
              {
                case: {
                  $and: [
                    { $gte: ["$targetCompletionRate", 40] },
                    { $lte: ["$targetCompletionRate", 60] },
                  ],
                },
                then: { $multiply: ["$totalSales", 0.01] },
              },
              {
                case: {
                  $and: [
                    { $gte: ["$targetCompletionRate", 61] },
                    { $lte: ["$targetCompletionRate", 80] },
                  ],
                },
                then: { $multiply: ["$totalSales", 0.02] },
              },
              {
                case: {
                  $and: [
                    { $gte: ["$targetCompletionRate", 81] },
                    { $lte: ["$targetCompletionRate", 100] },
                  ],
                },
                then: { $multiply: ["$totalSales", 0.03] },
              },
              {
                case: { $gt: ["$targetCompletionRate", 100] },
                then: { $multiply: ["$totalSales", 0.04] },
              },
            ],
            default: 0,
          },
        },
      },
    },

    {
      $project: {
        _id: 0,
        agentEmail: 1,
        agentName: 1,
        monthKey: "$_id.monthKey",
        monthLabel: { $dateToString: { format: "%b %Y", date: "$monthDate" } },
        totalSales: 1,
        basePrice: 1,
        targetCompletionRate: 1,
        commissionDue: 1,
      },
    },

    { $sort: { monthKey: -1, agentEmail: 1 } },
  ];

  // Optional filter for one month
  if (monthKey) {
    pipeline.push({ $match: { monthKey } });
  }

  return pipeline;
};

export const getCommissionList = async (req, res) => {
  try {
    const { email, monthKey } = req.query;

    // 1) compute current commission rows
    const computed = await lead.aggregate(
      buildCommissionPipeline({ email, monthKey }),
    );

    // 2) create/update snapshots (but NEVER overwrite locked)
    for (const row of computed) {
      const filter = {
        agentEmail: row.agentEmail.toLowerCase(),
        monthKey: row.monthKey,
      };

      const existing = await commissionSnapshot.findOne(filter).lean();
      if (existing?.locked) continue; // locked = do not change

      await commissionSnapshot.findOneAndUpdate(
        filter,
        {
          $set: {
            agentEmail: row.agentEmail.toLowerCase(),
            agentName: row.agentName,
            monthKey: row.monthKey,
            monthLabel: row.monthLabel,
            totalSales: row.totalSales,
            basePrice: row.basePrice,
            targetCompletionRate: row.targetCompletionRate,
            commissionDue: row.commissionDue,
            calcVersion: "v1",
          },
        },
        { upsert: true, new: true },
      );
    }

    // 3) now read snapshots (this is what UI trusts)
    const snapQuery = {};
    if (email) snapQuery.agentEmail = email.toLowerCase();
    if (monthKey) snapQuery.monthKey = monthKey;

    const snapshots = await commissionSnapshot
      .find(snapQuery)
      .sort({ monthKey: -1, agentEmail: 1 })
      .lean();

    // 4) sum payments
    const payMatch = { status: "completed" };
    if (email) payMatch.agentEmail = email.toLowerCase();
    if (monthKey) payMatch.monthKey = monthKey;

    const paymentSums = await commissionPayment.aggregate([
      { $match: payMatch },
      {
        $group: {
          _id: { agentEmail: "$agentEmail", monthKey: "$monthKey" },
          totalPaid: { $sum: "$amount" },
          lastPaidAt: { $max: "$paidAt" },
        },
      },
    ]);

    const map = new Map(
      paymentSums.map((p) => [`${p._id.agentEmail}__${p._id.monthKey}`, p]),
    );

    // 5) merge snapshot + paymentSum into final response
    const result = snapshots.map((s) => {
      const k = `${s.agentEmail}__${s.monthKey}`;
      const p = map.get(k);

      const totalPaid = p?.totalPaid || 0;
      const balance = Number((s.commissionDue - totalPaid).toFixed(2));

      let status = "unpaid";
      if (totalPaid > 0 && balance > 0) status = "partial";
      if (totalPaid > 0 && balance <= 0) status = "paid";

      return {
        agentEmail: s.agentEmail,
        agentName: s.agentName,
        monthKey: s.monthKey,
        month: s.monthLabel,

        totalSales: s.totalSales,
        basePrice: s.basePrice,
        targetCompletionRate: s.targetCompletionRate,
        commissionDue: s.commissionDue,

        totalPaid,
        balance,
        status,

        locked: s.locked,
        lastPaidAt: p?.lastPaidAt || null,
      };
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error(error);
    return res.status(400).json({ error: error.message });
  }
};

export const payCommission = async (req, res) => {
  try {
    const {
      agentEmail,
      monthKey,
      amount,
      method,
      reference,
      note,
      payer,
      payee
    } = req.body;

    if (!agentEmail || !monthKey) {
      return res.status(400).json({ error: "agentEmail and monthKey required" });
    }

    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return res.status(400).json({ error: "amount must be positive" });
    }

    const snap = await commissionSnapshot
      .findOne({
        agentEmail: agentEmail.toLowerCase(),
        monthKey,
      })
      .lean();

    if (!snap) {
      return res.status(400).json({ error: "snapshot not found" });
    }

    const payment = await commissionPayment.create({
      agentEmail: agentEmail.toLowerCase(),
      agentName: snap.agentName || "",
      monthKey,
      amount: amt,
      method: method || "",
      reference: reference || "",
      note: note || "",

      payer: {
        name: payer?.name || "",
        number: payer?.number || "",
        accountType: payer?.accountType || ""
      },

      payee: {
        name: payee?.name || "",
        number: payee?.number || "",
        accountDetails: payee?.accountDetails || ""
      },

      paidBy: "admin",
      status: "completed",
    });

    return res.status(201).json({
      message: "paid saved",
      payment
    });

  } catch (error) {
    console.error(error);
    return res.status(400).json({ error: error.message });
  }
};


export const getLastPaymentInfo = async (req, res) => {
  try {
    const { agentEmail } = req.params;

    if (!agentEmail) {
      return res.status(400).json({ error: "agentEmail required" });
    }

    const lastPayment = await commissionPayment
      .findOne({ agentEmail: agentEmail.toLowerCase() })
      .sort({ paidAt: -1 }) // latest first
      .lean();

    if (!lastPayment) {
      return res.json({ message: "No previous payment found" });
    }

    return res.json({
      payer: lastPayment.payer,
      payee: lastPayment.payee
    });

  } catch (error) {
    console.error(error);
    return res.status(400).json({ error: error.message });
  }
};


export const getCommissionPaymentHistory = async (req, res) => {
  try {
    const { agentEmail, monthKey } = req.query;

    const match = { status: "completed" };

    if (agentEmail) {
      match.agentEmail = agentEmail.toLowerCase();
    }

    if (monthKey) {
      match.monthKey = monthKey;
    }

    const payments = await commissionPayment
      .find(match)
      .sort({ paidAt: -1 })
      .lean();

    return res.status(200).json(payments);
  } catch (error) {
    console.error(error);
    return res.status(400).json({ error: error.message });
  }
};

export const closeCommissionMonth = async (req, res) => {
  try {
    const { monthKey, agentEmail } = req.body;

    if (!monthKey) return res.status(400).json({ error: "monthKey required" });

    // close one agent month
    if (agentEmail) {
      const updated = await commissionSnapshot.findOneAndUpdate(
        { agentEmail: agentEmail.toLowerCase(), monthKey },
        { $set: { locked: true } },
        { new: true },
      );
      return res.status(200).json({ message: "closed", snapshot: updated });
    }

    // close all agents for month
    const r = await commissionSnapshot.updateMany(
      { monthKey },
      { $set: { locked: true } },
    );

    return res
      .status(200)
      .json({ message: "closed month", modified: r.modifiedCount });
  } catch (error) {
    console.error(error);
    return res.status(400).json({ error: error.message });
  }
};

export const getAllAgentsMonthlyPayments = async (req, res) => {
  try {
    const { email } = req.query;

    const baseMatch = {};
    if (email) baseMatch.assignTo = email;

    const pipeline = [
      { $match: baseMatch },

      {
        $facet: {
          // ---------------------------------------------------------
          // 1) Payments: Group by UTC Month (Matches API 2 raw logic)
          // ---------------------------------------------------------
          monthlyPayments: [
            {
              $unwind: { path: "$history", preserveNullAndEmptyArrays: false },
            },
            {
              $addFields: {
                // FORCE CONVERT to Date (Fixes String issues)
                paymentDateObj: { $toDate: "$history.date" },
                paidAmountD: { $toDouble: "$history.paidAmount" },
              },
            },
            {
              $addFields: {
                // Group by UTC Month (YYYY-MM)
                monthKey: {
                  $dateToString: { format: "%Y-%m", date: "$paymentDateObj" },
                },
              },
            },
            {
              $group: {
                _id: { assignTo: "$assignTo", monthKey: "$monthKey" },
                totalPayments: { $sum: "$paidAmountD" },
              },
            },
          ],

          // ---------------------------------------------------------
          // 2) Refunds: Group by Enrollment UTC Month
          // ---------------------------------------------------------
          monthlyRefunds: [
            {
              $match: {
                refundAmount: { $gt: 0 },
                enrolledAt: { $exists: true, $ne: null },
              },
            },
            {
              $addFields: {
                enrolledDateObj: { $toDate: "$enrolledAt" },
                refundD: { $toDouble: { $ifNull: ["$refundAmount", 0] } },
              },
            },
            {
              $addFields: {
                monthKey: {
                  $dateToString: { format: "%Y-%m", date: "$enrolledDateObj" },
                },
              },
            },
            {
              $group: {
                _id: { assignTo: "$assignTo", monthKey: "$monthKey" },
                totalRefunds: { $sum: "$refundD" },
              },
            },
          ],

          // ---------------------------------------------------------
          // 3) Base Price: Group by Assignment UTC Month
          // ---------------------------------------------------------
          monthlyBasePrice: [
            { $match: { assignDate: { $exists: true, $ne: null } } },
            {
              $lookup: {
                from: "courses",
                let: {
                  topic: "$interstedCourse",
                  type: "$interstedCourseType",
                },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $and: [
                          { $eq: ["$name", "$$topic"] },
                          { $eq: ["$type", "$$type"] },
                        ],
                      },
                    },
                  },
                  { $project: { price: 1, _id: 0 } },
                  { $limit: 1 },
                ],
                as: "courseData",
              },
            },
            {
              $unwind: {
                path: "$courseData",
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $addFields: {
                effectivePrice: { $ifNull: ["$courseData.price", 0] },
                assignDateObj: { $toDate: "$assignDate" },
              },
            },
            {
              $addFields: {
                monthKey: {
                  $dateToString: { format: "%Y-%m", date: "$assignDateObj" },
                },
              },
            },
            {
              $group: {
                _id: { assignTo: "$assignTo", monthKey: "$monthKey" },
                basePrice: { $sum: "$effectivePrice" },
              },
            },
          ],
        },
      },

      // ---------------------------------------------------------
      // MERGE (No Logic Changes, just combining keys)
      // ---------------------------------------------------------
      {
        $project: {
          merged: {
            $concatArrays: [
              {
                $map: {
                  input: "$monthlyPayments",
                  as: "p",
                  in: {
                    assignTo: "$$p._id.assignTo",
                    monthKey: "$$p._id.monthKey",
                    totalPayments: "$$p.totalPayments",
                    totalRefunds: 0,
                    basePrice: 0,
                  },
                },
              },
              {
                $map: {
                  input: "$monthlyRefunds",
                  as: "r",
                  in: {
                    assignTo: "$$r._id.assignTo",
                    monthKey: "$$r._id.monthKey",
                    totalPayments: 0,
                    totalRefunds: "$$r.totalRefunds",
                    basePrice: 0,
                  },
                },
              },
              {
                $map: {
                  input: "$monthlyBasePrice",
                  as: "b",
                  in: {
                    assignTo: "$$b._id.assignTo",
                    monthKey: "$$b._id.monthKey",
                    totalPayments: 0,
                    totalRefunds: 0,
                    basePrice: "$$b.basePrice",
                  },
                },
              },
            ],
          },
        },
      },

      { $unwind: "$merged" },

      // Group back by Agent + MonthKey
      {
        $group: {
          _id: { assignTo: "$merged.assignTo", monthKey: "$merged.monthKey" },
          totalPayments: { $sum: "$merged.totalPayments" },
          totalRefunds: { $sum: "$merged.totalRefunds" },
          basePrice: { $sum: "$merged.basePrice" },
        },
      },

      // Logic: Total Sales
      {
        $addFields: {
          totalSales: { $subtract: ["$totalPayments", "$totalRefunds"] },
        },
      },

      // Join User for Target %
      {
        $lookup: {
          from: user.collection.name,
          localField: "_id.assignTo",
          foreignField: "email",
          as: "userData",
        },
      },
      { $unwind: "$userData" },

      // Calculate Target Amount
      {
        $addFields: {
          agentEmail: "$_id.assignTo",
          agentName: "$userData.name",
          // Convert string key back to date for sorting/display
          monthDate: {
            $dateFromString: {
              dateString: { $concat: ["$_id.monthKey", "-01"] },
            },
          },
          targetAmount: {
            $multiply: [
              "$basePrice",
              { $divide: [{ $ifNull: ["$userData.target", 0] }, 100] },
            ],
          },
        },
      },

      // Calculate Completion Rate (EXACT MATCH to API 2 logic)
      {
        $addFields: {
          targetCompletionRate: {
            $cond: [
              { $gt: ["$targetAmount", 0] },
              {
                $round: [
                  {
                    $multiply: [
                      { $divide: ["$totalSales", "$targetAmount"] },
                      100,
                    ],
                  },
                  0,
                ],
              },
              0, // If Target is 0, Rate is 0 (Matches API 2)
            ],
          },
        },
      },

      // Calculate Commission
      {
        $addFields: {
          commission: {
            $switch: {
              branches: [
                {
                  case: {
                    $and: [
                      { $gte: ["$targetCompletionRate", 40] },
                      { $lte: ["$targetCompletionRate", 60] },
                    ],
                  },
                  then: { $multiply: ["$totalSales", 0.01] },
                },
                {
                  case: {
                    $and: [
                      { $gte: ["$targetCompletionRate", 61] },
                      { $lte: ["$targetCompletionRate", 80] },
                    ],
                  },
                  then: { $multiply: ["$totalSales", 0.02] },
                },
                {
                  case: {
                    $and: [
                      { $gte: ["$targetCompletionRate", 81] },
                      { $lte: ["$targetCompletionRate", 100] },
                    ],
                  },
                  then: { $multiply: ["$totalSales", 0.03] },
                },
                {
                  case: { $gt: ["$targetCompletionRate", 100] },
                  then: { $multiply: ["$totalSales", 0.04] },
                },
              ],
              default: 0,
            },
          },
        },
      },

      { $sort: { monthDate: -1, agentEmail: 1 } },
      // Final Projection
      {
        $project: {
          _id: 0,
          agentEmail: 1,
          agentName: 1,
          commission: 1,
          targetCompletionRate: 1,
          totalSales: 1,
          basePrice: 1,
          targetCompletionRate: 1,
          monthKey: "$_id.monthKey",
          month: { $dateToString: { format: "%b %Y", date: "$monthDate" } },
        },
      },
    ];

    const data = await lead.aggregate(pipeline);
    return res.status(200).json(data);
  } catch (error) {
    console.error(error);
    return res.status(400).json({ error: error.message });
  }
};
