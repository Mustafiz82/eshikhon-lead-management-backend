import { Router } from "express"
import { createLead, createSingleLead, deleteLeads, getAllLeads, getLeadsCount, getLeadSources, markJoinedFromAttendance, updateLeads, updateSingleLead } from "../controllers/leadController.js"

export const leadRoute = Router()

leadRoute.post("/", createLead)
leadRoute.post("/single-lead", createSingleLead)
leadRoute.get("/", getAllLeads)
leadRoute.get("/count", getLeadsCount)
leadRoute.get("/source", getLeadSources)
leadRoute.patch("/", updateLeads)
leadRoute.patch("/:id", updateSingleLead)
leadRoute.post("/mark-attendence", markJoinedFromAttendance)
leadRoute.delete("/" , deleteLeads)

