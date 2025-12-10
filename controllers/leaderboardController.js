import mongoose from "mongoose";
import User from "../models/user.js";
import Lead from "../models/lead.js";

export const getLeaderboards = async (req, res) => {
  try {
    const { month, year } = req.query;
    const numericMonth = month && month !== "all" ? parseInt(month) : null;
    const numericYear = year ? parseInt(year) : new Date().getFullYear();

    // --- 1. Base Match Stage for Leads ---
    // We will filter the leads by date first for maximum performance.
    const leadMatch = {};
    // if (numericMonth) {
    //   const startOfMonth = new Date(numericYear, numericMonth - 1, 1);
    //   const endOfMonth = new Date(numericYear, numericMonth, 1);
    //   leadMatch.assignDate = { $gte: startOfMonth, $lt: endOfMonth };
    // }
    const startOfMonth = new Date(req.query.startDate);
    const endOfMonth = new Date(req.query.endDate);
    leadMatch.assignDate = { $gte: startOfMonth, $lt: endOfMonth };

    // --- Aggregation Pipeline ---
    const results = await Lead.aggregate([
      // Stage 1: Filter the leads down to only the relevant ones.
      { $match: leadMatch },

      // Stage 2: Get the course price for each lead.
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
          ],
          as: "courseData",
        },
      },
      { $unwind: { path: "$courseData", preserveNullAndEmptyArrays: true } },
      { $addFields: { effectivePrice: { $ifNull: ["$courseData.price", 0] } } },

      // Stage 3: Group by user to calculate all base stats. This avoids the 16MB limit.
      {
        $group: {
          _id: "$assignTo", // Group by the user's email
          leadCount: { $sum: 1 },
          basePrice: { $sum: "$effectivePrice" },
          enrolledCount: {
            $sum: { $cond: [{ $in: ["$leadStatus", ["Enrolled", "Refunded"]] }, 1, 0] },
          },
          totalPaidFromEnrolled: {
            $sum: {
              $cond: [
                { $in: ["$leadStatus", ["Enrolled", "Refunded"]] },
                { $ifNull: ["$totalPaid", 0] },
                0,
              ],
            },
          },
        },
      },

      // Stage 4: Join with the User collection to get details.
      {
        $lookup: {
          from: User.collection.name,
          localField: "_id",
          foreignField: "email",
          as: "userData",
        },
      },
      { $unwind: "$userData" },

      // Stage 5: Exclude admins from the leaderboard.
      { $match: { "userData.role": { $ne: "admin" } } },

      // Stage 6: Calculate the final derived metrics for each user.
      {
        $addFields: {
          name: "$userData.name",
          email: "$userData.email",
          target: "$userData.target",
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
          conversionRate: {
            $cond: [
              { $gt: ["$leadCount", 0] },
              { $round: [{ $multiply: [{ $divide: ["$enrolledCount", "$leadCount"] }, 100] }, 2] },
              0,
            ],
          },
          targetFilled: {
            $cond: [
              { $gt: ["$targetAmount", 0] },
              { $round: [{ $multiply: [{ $divide: ["$totalPaidFromEnrolled", "$targetAmount"] }, 100] }, 2] },
              0,
            ],
          },
        },
      },

      // Stage 7: Use $facet to create all four leaderboards, sorted correctly by the database.
      {
        $facet: {
          byAdmitCount: [
            { $sort: { enrolledCount: -1 } },
            { $project: { userData: 0, password: 0, refreshToken: 0 } }
          ],
          bySales: [
            { $sort: { totalPaidFromEnrolled: -1 } },
            { $project: { userData: 0, password: 0, refreshToken: 0 } }
          ],
          byConversion: [
            { $sort: { conversionRate: -1 } },
            { $project: { userData: 0, password: 0, refreshToken: 0 } }
          ],
          byTargetFilled: [
            { $sort: { targetFilled: -1 } },
            { $project: { userData: 0, password: 0, refreshToken: 0 } }
          ],
        },
      },
    ]);

    // The result from the aggregation is an array with a single object
    // that already has the exact structure we need.
    const leaderboards = results[0];

    return res.status(200).json(leaderboards);

  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
};



export const getAdminLeadStats = async (req, res) => {
  try {
    const month = parseInt(req.query.month) || (new Date().getMonth() + 1);
    const year = parseInt(req.query.year) || new Date().getFullYear();

    const startOfMonth = new Date(req.query.startDate);
    const endOfMonth = new Date(req.query.endDate);

    console.log(startOfMonth, endOfMonth)



    // const startOfMonth = new Date(year, month - 1, 1);
    // const endOfMonth = new Date(year, month, 1);

    // --- PART A: INFLUX (Created Date) ---
    const createdFilter = { createdAt: { $gte: startOfMonth, $lt: endOfMonth } };
    const AssignedDateFilter = { assignDate: { $gte: startOfMonth, $lt: endOfMonth } };

    const [totalLeads, totalAssignedCreated, totalUnassignedCreated] = await Promise.all([
      Lead.countDocuments(createdFilter),
      Lead.countDocuments({ ...AssignedDateFilter, assignStatus: true }),
      Lead.countDocuments({ ...createdFilter, assignStatus: false })
    ]);

    // --- PART B: PERFORMANCE (Complex Logic) ---
    const superMatch = {
      $or: [
        { assignDate: { $gte: startOfMonth, $lt: endOfMonth } },
        { lastContacted: { $gte: startOfMonth, $lt: endOfMonth } },
        { followUpDate: { $gte: startOfMonth, $lt: endOfMonth } },
        { enrolledAt: { $gte: startOfMonth, $lt: endOfMonth } },
        { "history.date": { $gte: startOfMonth, $lt: endOfMonth } }
      ]
    };

    const performanceStats = await Lead.aggregate([
      { $match: superMatch },
      // ... (Lookup Course Data) ...
      {
        $lookup: {
          from: "courses",
          let: { topic: "$interstedCourse", type: "$interstedCourseType" },
          pipeline: [
            { $match: { $expr: { $and: [{ $eq: ["$name", "$$topic"] }, { $eq: ["$type", "$$type"] }] } } },
            { $project: { price: 1, _id: 0 } },
          ],
          as: "courseData",
        },
      },
      { $unwind: { path: "$courseData", preserveNullAndEmptyArrays: true } },
      { $addFields: { effectivePrice: { $ifNull: ["$courseData.price", 0] } } },

      // Stage: GROUP BY AGENT
      {
        $group: {
          _id: "$assignTo",

          // ... (Existing metrics: pending, basePrice, etc.) ...
          pendingCount: {
            $sum: { $cond: [{ $and: [{ $gte: ["$assignDate", startOfMonth] }, { $lt: ["$assignDate", endOfMonth] }, { $eq: ["$leadStatus", "Pending"] }] }, 1, 0] }
          },
          basePrice: {
            $sum: { $cond: [{ $and: [{ $gte: ["$assignDate", startOfMonth] }, { $lt: ["$assignDate", endOfMonth] }] }, "$effectivePrice", 0] }
          },
          totalSales: {
            $sum: {
              $subtract: [
                {
                  $reduce: {
                    input: { $filter: { input: { $ifNull: ["$history", []] }, as: "p", cond: { $and: [{ $gte: ["$$p.date", startOfMonth] }, { $lt: ["$$p.date", endOfMonth] }] } } },
                    initialValue: 0,
                    in: { $sum: ["$$value", { $toDouble: "$$this.paidAmount" }] }
                  }
                },
                { $cond: [{ $and: [{ $gte: ["$enrolledAt", startOfMonth] }, { $lt: ["$enrolledAt", endOfMonth] }] }, { $ifNull: ["$refundAmount", 0] }, 0] }
              ]
            }
          },
          enrolledCount: {
            $sum: { $cond: [{ $and: [{ $gte: ["$enrolledAt", startOfMonth] }, { $lt: ["$enrolledAt", endOfMonth] }, { $in: ["$leadStatus", ["Enrolled", "Refunded"]] }] }, 1, 0] }
          },

          // --- REFUND AMOUNT ---
          totalRefunds: {
            $sum: { $cond: [{ $and: [{ $gte: ["$enrolledAt", startOfMonth] }, { $lt: ["$enrolledAt", endOfMonth] }] }, { $ifNull: ["$refundAmount", 0] }, 0] }
          },

          // --- NEW: REFUND COUNT ---
          refundCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gte: ["$enrolledAt", startOfMonth] },
                    { $lt: ["$enrolledAt", endOfMonth] },
                    { $gt: ["$refundAmount", 0] } // Check if refund amount > 0
                  ]
                },
                1, 0
              ]
            }
          },

          totalDue: {
            $sum: { $cond: [{ $and: [{ $gte: ["$assignDate", startOfMonth] }, { $lt: ["$assignDate", endOfMonth] }, { $eq: ["$leadStatus", "Enrolled"] }] }, { $max: [{ $subtract: ["$effectivePrice", "$totalPaid"] }, 0] }, 0] }
          },
          unreachableCount: {
            $sum: { $cond: [{ $and: [{ $gte: ["$lastContacted", startOfMonth] }, { $lt: ["$lastContacted", endOfMonth] }, { $in: ["$leadStatus", ["call declined", "Call Not Received", "Number Off or Busy", "Wrong Number"]] }] }, 1, 0] }
          },
          joinedOnSeminarCount: {
            $sum: { $switch: { branches: [{ case: { $eq: [{ $toLower: { $ifNull: ["$leadSource", ""] } }, "seminar"] }, then: { $cond: [{ $and: [{ $gte: ["$assignDate", startOfMonth] }, { $lt: ["$assignDate", endOfMonth] }] }, 1, 0] } }, { case: { $eq: ["$interstedSeminar", "Joined"] }, then: { $cond: [{ $and: [{ $gte: ["$lastContacted", startOfMonth] }, { $lt: ["$lastContacted", endOfMonth] }] }, 1, 0] } }], default: 0 } }
          }
        }
      },

      // ... (Lookup User & Calculations) ...
      {
        $lookup: { from: "users", localField: "_id", foreignField: "email", as: "userData" }
      },
      { $unwind: { path: "$userData", preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          individualTargetAmount: { $multiply: ["$basePrice", { $divide: [{ $ifNull: ["$userData.target", 0] }, 100] }] }
        }
      },
      {
        $addFields: {
          completionRate: { $cond: [{ $gt: ["$individualTargetAmount", 0] }, { $multiply: [{ $divide: ["$totalSales", "$individualTargetAmount"] }, 100] }, 0] }
        }
      },
      {
        $addFields: {
          individualCommission: {
            $switch: {
              branches: [
                { case: { $gt: ["$completionRate", 100] }, then: { $multiply: ["$totalSales", 0.04] } },
                { case: { $gte: ["$completionRate", 81] }, then: { $multiply: ["$totalSales", 0.03] } },
                { case: { $gte: ["$completionRate", 61] }, then: { $multiply: ["$totalSales", 0.02] } },
                { case: { $gte: ["$completionRate", 40] }, then: { $multiply: ["$totalSales", 0.01] } }
              ],
              default: 0
            }
          }
        }
      },

      // Stage: GLOBAL GROUPING
      {
        $group: {
          _id: null,
          totalPending: { $sum: "$pendingCount" },
          totalEnrolled: { $sum: "$enrolledCount" },
          totalSales: { $sum: "$totalSales" },
          totalRefunds: { $sum: "$totalRefunds" },
          totalRefundCount: { $sum: "$refundCount" }, // <--- SUMMING REFUND COUNTS
          totalDue: { $sum: "$totalDue" },
          totalUnreachable: { $sum: "$unreachableCount" },
          totalJoinedOnSeminar: { $sum: "$joinedOnSeminarCount" },
          grandTotalTargetAmount: { $sum: "$individualTargetAmount" },
          grandTotalCommission: { $sum: "$individualCommission" }
        }
      }
    ]);

    const complexStats = performanceStats[0] || {};

    return res.status(200).json({
      totalLeads,
      totalUnassigned: totalUnassignedCreated,
      totalAssigned: totalAssignedCreated,

      // Complex Stats
      totalEnrolled: complexStats.totalEnrolled || 0,
      totalPending: complexStats.totalPending || 0,
      totalSales: complexStats.totalSales || 0,
      joinedOnSeminar: complexStats.totalJoinedOnSeminar || 0,
      targetAmount: Math.round(complexStats.grandTotalTargetAmount || 0),
      commission: Math.round(complexStats.grandTotalCommission || 0),
      totalDue: complexStats.totalDue || 0,

      // Refunds
      totalRefunds: complexStats.totalRefunds || 0,
      refundedCount: complexStats.totalRefundCount || 0, // <--- Return Count

      totalUnreachable: complexStats.totalUnreachable || 0
    });

  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
};


export const getAgentleadState = async (req, res) => {
  try {
    const { email, id } = req.query;
    const month = parseInt(req.query.month);
    const year = parseInt(req.query.year);

    if (!month || !year) {
      return res.status(400).json({ error: "Month and Year are required" });
    }

    // --- 1. Date Ranges Setup ---
    // const startOfMonth = new Date(year, month - 1, 1);
    // const endOfMonth = new Date(year, month, 1);

    const startOfMonth = new Date(req.query.startDate);
    const endOfMonth = new Date(req.query.endDate);

    // For Option C (Today's Activity)
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    // --- 2. The "Super Filter" Match ---
    // Fetch leads that match ANY of your required dates using Schema fields
    const superMatch = {
      $or: [
        // Option A: Assigned this month
        { assignDate: { $gte: startOfMonth, $lt: endOfMonth } },
        // Option B: Last Contacted this month
        { lastContacted: { $gte: startOfMonth, $lt: endOfMonth } },
        // Option C: Last Contacted Today
        { lastContacted: { $gte: startOfToday, $lt: endOfToday } },
        // Option D: Follow Up this month
        { followUpDate: { $gte: startOfMonth, $lt: endOfMonth } },
        // Option E: Enrolled (First Payment/Enrollment Date) this month
        { enrolledAt: { $gte: startOfMonth, $lt: endOfMonth } },
        // Option F: Any payment inside history array this month
        { "history.date": { $gte: startOfMonth, $lt: endOfMonth } }
      ]
    };

    // Apply User Filter
    if (email) superMatch.assignTo = email;

    // --- 3. Status Arrays ---
    const connectedStatuses = [
      "Enrolled", "Will Join on Seminar", "Joined on seminar",
      "Not Interested", "Enrolled in Other Institute",
      "Call declined", "Call later", "Will Register", "Already Enrolled", "On hold"
    ];

    const unreachableStatuses = [
      "call declined", "Call Not Received", "Number Off or Busy", "Wrong Number"
    ];

    const usersWithStats = await Lead.aggregate([
      // Stage 1: The Super Filter
      { $match: superMatch },

      // Stage 2: Get Course Price (For Target Calculation)
      {
        $lookup: {
          from: "courses",
          let: { topic: "$interstedCourse", type: "$interstedCourseType" },
          pipeline: [
            { $match: { $expr: { $and: [{ $eq: ["$name", "$$topic"] }, { $eq: ["$type", "$$type"] }] } } },
            { $project: { price: 1, _id: 0 } },
          ],
          as: "courseData",
        },
      },
      { $unwind: { path: "$courseData", preserveNullAndEmptyArrays: true } },
      { $addFields: { effectivePrice: { $ifNull: ["$courseData.price", 0] } } },

      // Stage 3: GROUP & CONDITIONAL COUNTING
      {
        $group: {
          _id: "$assignTo",

          // --- OPTION A: Assign Date Based ---
          // Field: assignDate
          leadCount: {
            $sum: {
              $cond: [
                { $and: [{ $gte: ["$assignDate", startOfMonth] }, { $lt: ["$assignDate", endOfMonth] }] },
                1, 0
              ]
            }
          },
          basePrice: {
            $sum: {
              $cond: [
                { $and: [{ $gte: ["$assignDate", startOfMonth] }, { $lt: ["$assignDate", endOfMonth] }] },
                "$effectivePrice", 0
              ]
            }
          },

          totalDue: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gte: ["$assignDate", startOfMonth] },
                    { $lt: ["$assignDate", endOfMonth] },
                    { $eq: ["$leadStatus", "Enrolled"] }
                  ]
                },
                {
                  $max: [
                    {
                      $subtract: [
                        "$effectivePrice",
                        {
                          $sum: {
                            $map: {
                              input: { $ifNull: ["$history", []] },
                              as: "p",
                              in: { $toDouble: "$$p.paidAmount" }
                            }
                          }
                        }
                      ]
                    },
                    0
                  ]
                },
                0
              ]
            }
          },

          pendingCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gte: ["$assignDate", startOfMonth] },
                    { $lt: ["$assignDate", endOfMonth] },
                    { $eq: ["$leadStatus", "Pending"] }
                  ]
                },
                1, 0
              ]
            }
          },

          // --- OPTION B: Last Contacted Based ---
          // Field: lastContacted (from Schema)
          unreachableCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gte: ["$lastContacted", startOfMonth] },
                    { $lt: ["$lastContacted", endOfMonth] },
                    { $in: ["$leadStatus", unreachableStatuses] }
                  ]
                },
                1, 0
              ]
            }
          },


          totalConnectedCall: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gte: ["$lastContacted", startOfMonth] },
                    { $lt: ["$lastContacted", endOfMonth] },
                    { $in: ["$leadStatus", connectedStatuses] }
                  ]
                },
                1, 0
              ]
            }
          },

          // --- OPTION C: Present Day (Today) Based ---
          // Field: lastContacted (Checking against Today's date range)
          connectedCallCountToday: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gte: ["$lastContacted", startOfToday] },
                    { $lt: ["$lastContacted", endOfToday] },
                    { $in: ["$leadStatus", connectedStatuses] }
                  ]
                },
                1, 0
              ]
            }
          },

          // --- OPTION D: Follow Up Date Based ---
          // Field: followUpDate
          followUpCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gte: ["$followUpDate", startOfMonth] },
                    { $lt: ["$followUpDate", endOfMonth] }
                  ]
                },
                1, 0
              ]
            }
          },

          // --- OPTION E: Enrolled Date Based ---
          // Field: enrolledAt (Using this as the "First Payment/Enrollment" date)
          totalEnrolled: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gte: ["$enrolledAt", startOfMonth] },
                    { $lt: ["$enrolledAt", endOfMonth] },
                    { $in: ["$leadStatus", ["Enrolled", "Refunded"]] }

                  ]
                },
                1, 0
              ]
            }
          },

          // --- OPTION F: Sales Sum Based ---
          // Field: history (Array in Schema) -> paidAmount

          totalSales: {
            $sum: {
              $subtract: [
                // 1. POSITIVE: Sum of payments made in the selected month
                {
                  $reduce: {
                    input: {
                      $filter: {
                        input: { $ifNull: ["$history", []] },
                        as: "p",
                        cond: {
                          $and: [
                            { $gte: ["$$p.date", startOfMonth] },
                            { $lt: ["$$p.date", endOfMonth] }
                          ]
                        }
                      }
                    },
                    initialValue: 0,
                    in: { $sum: ["$$value", { $toDouble: "$$this.paidAmount" }] }
                  }
                },

                // 2. NEGATIVE: Subtract refundAmount ONLY if selected month == Enrollment Month
                {
                  $cond: [
                    {
                      $and: [
                        // Check if enrolledAt falls within the filtered Month/Year
                        { $gte: ["$enrolledAt", startOfMonth] },
                        { $lt: ["$enrolledAt", endOfMonth] }
                      ]
                    },
                    // If YES (This is the enrollment month), subtract the refund amount
                    { $ifNull: ["$refundAmount", 0] },
                    // If NO (This is a later month, e.g., November), subtract 0
                    0
                  ]
                }
              ]
            }
          },

          totalRefunds: {
            $sum: {
              $cond: [
                {
                  $and: [
                    // 1. Check if Enrollment Date matches the selected Month
                    { $gte: ["$enrolledAt", startOfMonth] },
                    { $lt: ["$enrolledAt", endOfMonth] }
                  ]
                },
                // 2. If YES, add the refundAmount
                { $ifNull: ["$refundAmount", 0] },
                // 3. If NO (different month), add 0
                0
              ]
            }
          },

          // Optional: If you also want to count HOW MANY students got refunded
          refundedCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gte: ["$enrolledAt", startOfMonth] },
                    { $lt: ["$enrolledAt", endOfMonth] },
                    { $gt: ["$refundAmount", 0] } // Check if refund amount is greater than 0
                  ]
                },
                1,
                0
              ]
            }
          },


          // --- SPECIAL LOGIC: Joined On Seminar ---
          joinedOnSeminarCount: {
            $sum: {
              $switch: {
                branches: [
                  // Condition 1: Lead Source is "seminar" -> Use Option A (AssignDate)
                  {
                    case: { $eq: [{ $toLower: { $ifNull: ["$leadSource", ""] } }, "seminar"] },
                    then: {
                      $cond: [
                        { $and: [{ $gte: ["$assignDate", startOfMonth] }, { $lt: ["$assignDate", endOfMonth] }] },
                        1, 0
                      ]
                    }
                  },
                  // Condition 2: interstedSeminar is "Joined" -> Use Option B (lastContacted)
                  {
                    case: { $eq: ["$interstedSeminar", "Joined"] },
                    then: {
                      $cond: [
                        { $and: [{ $gte: ["$lastContacted", startOfMonth] }, { $lt: ["$lastContacted", endOfMonth] }] },
                        1, 0
                      ]
                    }
                  }
                ],
                default: 0 // If neither matches, count 0
              }
            }
          }

        }
      },

      // Stage 4: Join User Data
      {
        $lookup: {
          from: User.collection.name,
          localField: "_id",
          foreignField: "email",
          as: "userData",
        },
      },
      { $match: { "userData": { $ne: [] } } },
      { $unwind: "$userData" },

      // Stage 5: Merge
      {
        $replaceRoot: { newRoot: { $mergeObjects: ["$userData", "$$ROOT"] } },
      },

      // Stage 6: Calculate Targets based on Total Sales (Option F)
      {
        $addFields: {
          // Target Amount = (Base Price from AssignDate) * Target %
          targetAmount: {
            $multiply: [
              "$basePrice",
              { $divide: [{ $ifNull: ["$target", 0] }, 100] },
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
                  { $multiply: [{ $divide: ["$totalSales", "$targetAmount"] }, 100] },
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
          commission: {
            $switch: {
              branches: [
                { case: { $and: [{ $gte: ["$targetCompletionRate", 40] }, { $lte: ["$targetCompletionRate", 60] }] }, then: { $multiply: ["$totalSales", 0.01] } },
                { case: { $and: [{ $gte: ["$targetCompletionRate", 61] }, { $lte: ["$targetCompletionRate", 80] }] }, then: { $multiply: ["$totalSales", 0.02] } },
                { case: { $and: [{ $gte: ["$targetCompletionRate", 81] }, { $lte: ["$targetCompletionRate", 100] }] }, then: { $multiply: ["$totalSales", 0.03] } },
                { case: { $gt: ["$targetCompletionRate", 100] }, then: { $multiply: ["$totalSales", 0.04] } }
              ],
              default: 0,
            },
          },
        },
      },

      // Stage 7: Clean
      {
        $project: {
          password: 0,
          refreshToken: 0,
          userData: 0,
        },
      },
    ]);

    if (email || id) {
      if (usersWithStats.length > 0) {
        return res.status(200).json(usersWithStats[0]);
      } else {
        const user = await User.findOne({ $or: [{ email }, { _id: id }] }).select('-password -refreshToken');
        return res.status(200).json(user || null);
      }
    }

    return res.status(200).json(usersWithStats);
  } catch (error) {
    console.error(error);
    return res.status(400).json({ error: error.message });
  }
};



export const getLeadsGrowth = async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();

    const monthlyStats = await Promise.all(
      Array.from({ length: 12 }, (_, i) => {
        const start = new Date(year, i, 1);
        const end = new Date(year, i + 1, 1);

        return Promise.all([
          Lead.countDocuments({ createdAt: { $gte: start, $lt: end } }),
          Lead.countDocuments({
            createdAt: { $gte: start, $lt: end },
            leadStatus: "Enrolled",
          }),
        ]);
      })
    );

    const totalLeads = monthlyStats.map(([t]) => t);
    const enrolledLeads = monthlyStats.map(([_, e]) => e);

    return res.json({ totalLeads, enrolledLeads });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
};



export const getDailyCallCount = async (req, res) => {
  try {
    const month = parseInt(req.query.month) || (new Date().getMonth() + 1); // 1-12
    const year = parseInt(req.query.year) || new Date().getFullYear();

    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 1);

    // ✅ Only fetch users that are not admin
    const activeUsers = await User.find(
      { role: { $ne: "admin" } },
      { email: 1, name: 1 }
    );

    console.log(activeUsers.map(u => u.email))

    const stats = await Lead.aggregate([
      {
        $match: {
          assignTo: { $in: activeUsers.map(u => u.email) },
          lastContacted: { $gte: startOfMonth, $lt: endOfMonth },
          leadStatus: {
            $in: [
              "Enrolled", "Will Join on Seminar", "Joined on seminar",
              "Not Interested", "Enrolled in Other Institute",
              "Call declined", "Call later", "Will Register", "Already Enrolled", "On hold"
            ]
          }
        }
      },
      {
        $group: {
          _id: {
            agent: "$assignTo",
            day: { $dayOfMonth: "$lastContacted" }
          },
          callCount: { $sum: 1 }
        }
      },
      { $sort: { "_id.agent": 1, "_id.day": 1 } }
    ]);

    console.log(stats)

    const daysInMonth = new Date(year, month, 0).getDate();
    const result = activeUsers.map(user => ({
      name: user.name || user.email,
      calls: Array(daysInMonth).fill(0),
    }));

    console.log(result)

    stats.forEach(s => {
      const idx = result.findIndex(r => r.name === (activeUsers.find(u => u.email === s._id.agent)?.name || s._id.agent));
      if (idx !== -1) {
        result[idx].calls[s._id.day - 1] = s.callCount;
      }
    });

    return res.status(200).json(result);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
};


