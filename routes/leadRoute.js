import { Router } from "express"
import { checkLeadSimilarity, createLead, createSingleLead, deleteLeads, getAllLeads, getInterestedCourses, getLeadsCount, getLeadSources, getOrderDetails, markJoinedFromAttendance, updateLeads, updateSingleCreatedLead, updateSingleLead } from "../controllers/leadController.js"
import { verifyAdmin } from "../middleware/authMiddleware.js"

export const leadRoute = Router()

leadRoute.post("/", createLead)
leadRoute.post("/check-similarity", checkLeadSimilarity)
leadRoute.post("/single-lead", createSingleLead)
leadRoute.put("/single-lead/:id", updateSingleCreatedLead)
leadRoute.get("/", getAllLeads)
leadRoute.get("/count", getLeadsCount)
leadRoute.get("/source", getLeadSources)
leadRoute.get("/intersted-course", getInterestedCourses)
leadRoute.get("/order/:id", getOrderDetails)
leadRoute.patch("/", updateLeads)
leadRoute.patch("/:id", updateSingleLead)
leadRoute.post("/mark-attendence", markJoinedFromAttendance)
leadRoute.delete("/" , verifyAdmin , deleteLeads)

