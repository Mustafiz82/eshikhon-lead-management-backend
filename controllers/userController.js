
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
    // pick month/year or fallback
    const { month, year, email, id } = req.query;
    const numericMonth = month && month !== "all" ? parseInt(month) : null;
    const numericYear = year ? parseInt(year) : new Date().getFullYear();

    const startOfMonth = numericMonth
      ? new Date(numericYear, numericMonth - 1, 1)
      : null;
    const endOfMonth = numericMonth
      ? new Date(numericYear, numericMonth, 1)
      : null;

    // early filter by email/id
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
            { $addFields: { effectivePrice: { $ifNull: ["$courseData.price", 0] } } }
          ]
        }
      },
      {
        $addFields: {
          // Leads assigned (monthly or all)
          monthlyAssignedLeads: {
            $cond: [
              { $eq: [month, "all"] },
              "$assignedLeads", // take all
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

          // Leads enrolled (monthly or all)
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
      // (rest of your $addFields and commission logic unchanged...)
      { $project: { password: 0, refreshToken: 0, assignedLeads: 0 } }
    ]);

    // return single if email/id used
    if (email || id) {
      return res.status(200).json(users[0] || null);
    }
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