import lead from "../models/lead.js";
import user from "../models/user.js";

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
            { $unwind: { path: "$history", preserveNullAndEmptyArrays: false } },
            {
              $addFields: {
                // FORCE CONVERT to Date (Fixes String issues)
                paymentDateObj: { $toDate: "$history.date" },
                paidAmountD: { $toDouble: "$history.paidAmount" }
              }
            },
            {
              $addFields: {
                // Group by UTC Month (YYYY-MM)
                monthKey: { $dateToString: { format: "%Y-%m", date: "$paymentDateObj" } }
              }
            },
            {
              $group: {
                _id: { assignTo: "$assignTo", monthKey: "$monthKey" },
                totalPayments: { $sum: "$paidAmountD" }
              }
            }
          ],

          // ---------------------------------------------------------
          // 2) Refunds: Group by Enrollment UTC Month
          // ---------------------------------------------------------
          monthlyRefunds: [
            {
              $match: {
                refundAmount: { $gt: 0 },
                enrolledAt: { $exists: true, $ne: null }
              }
            },
            {
              $addFields: {
                enrolledDateObj: { $toDate: "$enrolledAt" },
                refundD: { $toDouble: { $ifNull: ["$refundAmount", 0] } }
              }
            },
            {
              $addFields: {
                monthKey: { $dateToString: { format: "%Y-%m", date: "$enrolledDateObj" } }
              }
            },
            {
              $group: {
                _id: { assignTo: "$assignTo", monthKey: "$monthKey" },
                totalRefunds: { $sum: "$refundD" }
              }
            }
          ],

          // ---------------------------------------------------------
          // 3) Base Price: Group by Assignment UTC Month
          // ---------------------------------------------------------
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
                          { $eq: ["$type", "$$type"] }
                        ]
                      }
                    }
                  },
                  { $project: { price: 1, _id: 0 } },
                  { $limit: 1 }
                ],
                as: "courseData"
              }
            },
            { $unwind: { path: "$courseData", preserveNullAndEmptyArrays: true } },
            { 
              $addFields: { 
                effectivePrice: { $ifNull: ["$courseData.price", 0] },
                assignDateObj: { $toDate: "$assignDate" } 
              } 
            },
            {
              $addFields: {
                monthKey: { $dateToString: { format: "%Y-%m", date: "$assignDateObj" } }
              }
            },
            {
              $group: {
                _id: { assignTo: "$assignTo", monthKey: "$monthKey" },
                basePrice: { $sum: "$effectivePrice" }
              }
            }
          ]
        }
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
                    basePrice: 0
                  }
                }
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
                    basePrice: 0
                  }
                }
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
                    basePrice: "$$b.basePrice"
                  }
                }
              }
            ]
          }
        }
      },

      { $unwind: "$merged" },

      // Group back by Agent + MonthKey
      {
        $group: {
          _id: { assignTo: "$merged.assignTo", monthKey: "$merged.monthKey" },
          totalPayments: { $sum: "$merged.totalPayments" },
          totalRefunds: { $sum: "$merged.totalRefunds" },
          basePrice: { $sum: "$merged.basePrice" }
        }
      },

      // Logic: Total Sales
      {
        $addFields: {
          totalSales: { $subtract: ["$totalPayments", "$totalRefunds"] }
        }
      },

      // Join User for Target %
      {
        $lookup: {
          from: user.collection.name,
          localField: "_id.assignTo",
          foreignField: "email",
          as: "userData"
        }
      },
      { $unwind: "$userData" },

      // Calculate Target Amount
      {
        $addFields: {
          agentEmail: "$_id.assignTo",
          agentName: "$userData.name",
          // Convert string key back to date for sorting/display
          monthDate: { $dateFromString: { dateString: { $concat: ["$_id.monthKey", "-01"] } } },
          targetAmount: {
            $multiply: [
              "$basePrice",
              { $divide: [{ $ifNull: ["$userData.target", 0] }, 100] }
            ]
          }
        }
      },

      // Calculate Completion Rate (EXACT MATCH to API 2 logic)
      {
        $addFields: {
          targetCompletionRate: {
            $cond: [
              { $gt: ["$targetAmount", 0] },
              {
                $round: [
                  { $multiply: [{ $divide: ["$totalSales", "$targetAmount"] }, 100] },
                  0
                ]
              },
              0 // If Target is 0, Rate is 0 (Matches API 2)
            ]
          }
        }
      },

      // Calculate Commission
      {
        $addFields: {
          commission: {
            $switch: {
              branches: [
                {
                  case: { $and: [{ $gte: ["$targetCompletionRate", 40] }, { $lte: ["$targetCompletionRate", 60] }] },
                  then: { $multiply: ["$totalSales", 0.01] }
                },
                {
                  case: { $and: [{ $gte: ["$targetCompletionRate", 61] }, { $lte: ["$targetCompletionRate", 80] }] },
                  then: { $multiply: ["$totalSales", 0.02] }
                },
                {
                  case: { $and: [{ $gte: ["$targetCompletionRate", 81] }, { $lte: ["$targetCompletionRate", 100] }] },
                  then: { $multiply: ["$totalSales", 0.03] }
                },
                {
                  case: { $gt: ["$targetCompletionRate", 100] },
                  then: { $multiply: ["$totalSales", 0.04] }
                }
              ],
              default: 0
            }
          }
        }
      },

      // Final Projection
      {
        $project: {
          _id: 0,
          agentEmail: 1,
          agentName: 1,
          commission: 1,
          targetCompletionRate: 1,
          totalSales: 1,
          basePrice : 1 , 
          targetCompletionRate : 1 ,
          month: { $dateToString: { format: "%b %Y", date: "$monthDate" } } 
        }
      },

      { $sort: { monthDate: -1, agentEmail: 1 } }
    ];

    const data = await lead.aggregate(pipeline);
    return res.status(200).json(data);
  } catch (error) {
    console.error(error);
    return res.status(400).json({ error: error.message });
  }
};