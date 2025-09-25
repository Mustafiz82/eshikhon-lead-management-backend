
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
export const getAllUser = async (req, res) => {
  try {
  
    const { email, id } = req.query; // optional filters

    const month = req.query.month;
    const year = req.query.year;

    let startOfMonth = null, endOfMonth = null;
    if (month && month !== "all") {
      startOfMonth = new Date(year, month - 1, 1);
      endOfMonth = new Date(year, month, 1);
    }


    // if id/email present, match early to optimize
    const matchStage = [];
    if (email) matchStage.push({ $match: { email } });
    if (id) matchStage.push({ $match: { _id: new mongoose.Types.ObjectId(id) } });

    const users = await User.aggregate([
      ...matchStage,
      {
        $lookup: {
          from: lead.collection.name,
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
            {
              $addFields: {
                effectivePrice: { $ifNull: ["$courseData.price", 0] }
              }
            }
          ]
        }
      },
      {
        $addFields: {
          // Leads assigned this month
          monthlyAssignedLeads: {
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
          },

          // Leads enrolled this month
          monthlyEnrolledLeads: {
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
          targetCompletionRate: {
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
                  0
                ]
              },
              0
            ]
          }
        }
      },
      {
        $addFields: {
          commission: {
            $switch: {
              branches: [
                {
                  case: {
                    $and: [
                      { $gte: ["$targetCompletionRate", 40] },
                      { $lte: ["$targetCompletionRate", 60] }
                    ]
                  },
                  then: { $multiply: ["$totalPaidFromEnrolled", 0.01] }
                },
                {
                  case: {
                    $and: [
                      { $gte: ["$targetCompletionRate", 61] },
                      { $lte: ["$targetCompletionRate", 80] }
                    ]
                  },
                  then: { $multiply: ["$totalPaidFromEnrolled", 0.02] }
                },
                {
                  case: {
                    $and: [
                      { $gte: ["$targetCompletionRate", 81] },
                      { $lte: ["$targetCompletionRate", 100] }
                    ]
                  },
                  then: { $multiply: ["$totalPaidFromEnrolled", 0.03] }
                },
                {
                  case: { $gt: ["$targetCompletionRate", 100] },
                  then: { $multiply: ["$totalPaidFromEnrolled", 0.04] }
                }
              ],
              default: 0
            }
          }
        }
      },
      {
        $addFields: {
          // Other monthly status counts
          pendingCount: {
            $size: {
              $filter: {
                input: "$monthlyAssignedLeads",
                as: "l",
                cond: { $eq: ["$$l.leadStatus", "Pending"] }
              }
            }
          },
          joinedOnSeminarCount: {
            $size: {
              $filter: {
                input: "$monthlyAssignedLeads",
                as: "l",
                cond: { $eq: ["$$l.leadStatus", "Joined on seminar"] }
              }
            }
          },
          followUpCount: {
            $size: {
              $filter: {
                input: "$monthlyAssignedLeads",
                as: "l",
                cond: {
                  $and: [
                    { $ne: [{ $ifNull: ["$$l.followUpDate", null] }, null] },
                    { $ne: ["$$l.followUpDate", ""] },
                    { $eq: [{ $type: "$$l.followUpDate" }, "date"] },
                    { $gte: ["$$l.assignDate", startOfMonth] },
                    { $lt: ["$$l.assignDate", endOfMonth] }
                  ]
                }
              }
            }
          }
        }
      },
      {
        $addFields: {
          connectedCallsToday: {
            $size: {
              $filter: {
                input: "$assignedLeads",
                as: "lead",
                cond: {
                  $and: [
                    {
                      $in: ["$$lead.leadStatus", [
                        "Enrolled",
                        "Will Join on Seminar",
                        "Joined on seminar",
                        "Not Interested",
                        "Enrolled in Other Institute",
                      ]]
                    },
                    {
                      $eq: [
                        {
                          $dateToString: { format: "%Y-%m-%d", date: "$$lead.lastContacted" }
                        },
                        {
                          $dateToString: { format: "%Y-%m-%d", date: new Date() }
                        }
                      ]
                    }
                  ]
                }
              }
            }
          }
        }
      },
      {
        $addFields: {
          // 1. Overdue Leads
          overdueCount: {
            $size: {
              $filter: {
                input: "$assignedLeads",
                as: "l",
                cond: {
                  $and: [
                    { $ne: ["$$l.followUpDate", null] },
                    { $eq: [{ $type: "$$l.followUpDate" }, "date"] },
                    { $lt: ["$$l.followUpDate", new Date()] },
                    ...(startOfMonth && endOfMonth
                      ? [
                        { $gte: ["$$l.followUpDate", startOfMonth] },
                        { $lt: ["$$l.followUpDate", endOfMonth] }
                      ]
                      : [])
                  ]
                }
              }
            }
          }         ,

          // 2. Unreachable Leads
          unreachableCount: {
            $size: {
              $filter: {
                input: "$monthlyAssignedLeads",
                as: "l",
                cond: {
                  $in: [
                    "$$l.leadStatus",
                    ["Cut the Call", "Call Not Received", "Number Off or Busy", "Wrong Number"]
                  ]
                }
              }
            }
          }
        }
      }

      ,
      { $project: { password: 0, refreshToken: 0, assignedLeads: 0 } }
    ]);

    // return single if user requested by email/id
    if (email || id) {
      return res.status(200).json(users[0] || null);
    }

    // else return array
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