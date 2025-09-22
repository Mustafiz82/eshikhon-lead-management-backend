import mongoose from "mongoose";
import User from "../models/user.js";
import Lead from "../models/lead.js";

export const getLeaderboards = async (req, res) => {
  try {
    const { month, year } = req.query;
    const numericMonth = month && month !== "all" ? parseInt(month) : null;
    const numericYear = year ? parseInt(year) : new Date().getFullYear();

    const startOfMonth = numericMonth
      ? new Date(numericYear, numericMonth - 1, 1)
      : null;
    const endOfMonth = numericMonth
      ? new Date(numericYear, numericMonth, 1)
      : null;

    const users = await User.aggregate([
      // ✅ exclude admins
      { $match: { role: { $ne: "admin" } } },

      {
        $lookup: {
          from: Lead.collection.name,
          localField: "email",
          foreignField: "assignTo",
          as: "assignedLeads",
          pipeline: [
            {
              $lookup: {
                from: "courses",
                let: { topic: "$seminarTopic", type: "$seminarType" },
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
                  { $project: { price: 1, _id: 0 } }
                ],
                as: "courseData"
              }
            },
            { $unwind: { path: "$courseData", preserveNullAndEmptyArrays: true } },
            { $addFields: { effectivePrice: { $ifNull: ["$courseData.price", 0] } } }
          ]
        }
      },
      {
        $addFields: {
          // leads assigned in this month or all
          monthlyAssignedLeads: {
            $cond: [
              { $eq: [month, "all"] },
              "$assignedLeads",
              {
                $filter: {
                  input: "$assignedLeads",
                  as: "l",
                  cond: {
                    $and: [
                      { $gte: ["$$l.assignDate", startOfMonth] },
                      { $lt: ["$$l.assignDate", endOfMonth] }
                    ]
                  }
                }
              }
            ]
          },
          // enrolled leads
          monthlyEnrolledLeads: {
            $cond: [
              { $eq: [month, "all"] },
              {
                $filter: {
                  input: "$assignedLeads",
                  as: "l",
                  cond: { $eq: ["$$l.leadStatus", "Enrolled"] }
                }
              },
              {
                $filter: {
                  input: "$assignedLeads",
                  as: "l",
                  cond: {
                    $and: [
                      { $eq: ["$$l.leadStatus", "Enrolled"] },
                      { $gte: ["$$l.enrolledAt", startOfMonth] },
                      { $lt: ["$$l.enrolledAt", endOfMonth] }
                    ]
                  }
                }
              }
            ]
          }
        }
      },
      {
        $addFields: {
          // Assignment side
          leadCount: { $size: "$monthlyAssignedLeads" },
          basePrice: {
            $sum: {
              $map: {
                input: "$monthlyAssignedLeads",
                as: "l",
                in: { $ifNull: ["$$l.effectivePrice", 0] }
              }
            }
          },
          targetAmount: {
            $multiply: [
              {
                $sum: {
                  $map: {
                    input: "$monthlyAssignedLeads",
                    as: "l",
                    in: { $ifNull: ["$$l.effectivePrice", 0] }
                  }
                }
              },
              { $divide: [{ $ifNull: ["$target", 0] }, 100] }
            ]
          },
          // Enrollment side
          totalPaidFromEnrolled: {
            $sum: {
              $map: {
                input: "$monthlyEnrolledLeads",
                as: "en",
                in: { $ifNull: ["$$en.totalPaid", 0] }
              }
            }
          },
          enrolledCount: { $size: "$monthlyEnrolledLeads" }
        }
      },
      {
        $addFields: {
          conversionRate: {
            $cond: [
              { $gt: ["$leadCount", 0] },
              {
                $round: [
                  {
                    $multiply: [
                      { $divide: ["$enrolledCount", "$leadCount"] },
                      100
                    ]
                  },
                  2
                ]
              },
              0
            ]
          },
          targetFilled: {
            $cond: [
              { $gt: ["$targetAmount", 0] },
              {
                $round: [
                  {
                    $multiply: [
                      { $divide: ["$totalPaidFromEnrolled", "$targetAmount"] },
                      100
                    ]
                  },
                  2
                ]
              },
              0
            ]
          }
        }
      },
      { $project: { password: 0, refreshToken: 0, assignedLeads: 0 } }
    ]);

    // 🔥 Leaderboard categories
    const byAdmitCount = [...users].sort((a, b) => b.enrolledCount - a.enrolledCount);
    const bySales = [...users].sort((a, b) => b.totalPaidFromEnrolled - a.totalPaidFromEnrolled);
    const byConversion = [...users].sort((a, b) => b.conversionRate - a.conversionRate);
    const byTargetFilled = [...users].sort((a, b) => b.targetFilled - a.targetFilled);

    return res.status(200).json({
      byAdmitCount,
      bySales,
      byConversion,
      byTargetFilled
    });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
};
