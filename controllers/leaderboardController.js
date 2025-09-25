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


export const getAdminLeadStats = async (req, res) => {
  try {
    // month/year filter from query

    console.log("hit")
    const month = parseInt(req.query.month) || (new Date().getMonth() + 1);
    const year = parseInt(req.query.year) || new Date().getFullYear();

    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 1);

    const stats = await Lead.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfMonth, $lt: endOfMonth } // base filter by month
        }
      },
      {
        $group: {
          _id: null,
          totalLeads: { $sum: 1 },

          assignedLeads: {
            $sum: { $cond: [{ $eq: ["$assignStatus", true] }, 1, 0] }
          },
          notAssignedLeads: {
            $sum: { $cond: [{ $eq: ["$assignStatus", false] }, 1, 0] }
          },

          joinedOnSeminar: {
            $sum: { $cond: [{ $eq: ["$leadStatus", "Joined on seminar"] }, 1, 0] }
          },
          totalEnrolled: {
            $sum: { $cond: [{ $eq: ["$leadStatus", "Enrolled"] }, 1, 0] }
          },

          totalSales: {
            $sum: {
              $cond: [
                { $eq: ["$leadStatus", "Enrolled"] },
                { $ifNull: ["$totalPaid", 0] },
                0
              ]
            }
          },

          overdueLeads: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ["$followUpDate", null] },
                    { $ne: ["$followUpDate", ""] },
                    { $eq: [{ $type: "$followUpDate" }, "date"] },
                    { $lt: ["$followUpDate", new Date()] },
                    { $gte: ["$followUpDate", startOfMonth] },
                    { $lt: ["$followUpDate", endOfMonth] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $project: { _id: 0 }
      }
    ]);

    return res.status(200).json(stats[0] || {
      totalLeads: 0,
      assignedLeads: 0,
      notAssignedLeads: 0,
      joinedOnSeminar: 0,
      totalEnrolled: 0,
      totalSales: 0,
      overdueLeads: 0
    });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
};



export const getLeadsGrowth = async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();

    const stats = await Lead.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(year, 0, 1), // Jan 1
            $lt: new Date(year + 1, 0, 1), // Next Jan 1
          },
        },
      },
      {
        $group: {
          _id: { month: { $month: "$createdAt" } },
          totalLeads: { $sum: 1 },
          enrolledLeads: {
            $sum: { $cond: [{ $eq: ["$leadStatus", "Enrolled"] }, 1, 0] },
          },
        },
      },
      { $sort: { "_id.month": 1 } },
    ]);

    // create 12-month arrays
    const totalLeadsArr = Array(12).fill(0);
    const enrolledLeadsArr = Array(12).fill(0);

    stats.forEach((s) => {
      const m = s._id.month - 1; // 0-based index
      totalLeadsArr[m] = s.totalLeads;
      enrolledLeadsArr[m] = s.enrolledLeads;
    });

    return res.status(200).json({
      totalLeads: totalLeadsArr,
      enrolledLeads: enrolledLeadsArr,
    });
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
              "Enrolled",
              "Will Join on Seminar",
              "Joined on seminar",
              "Not Interested",
              "Enrolled in Other Institute"
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


