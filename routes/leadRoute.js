import {Router} from  "express"
import { createLead, getAllLeads, getLeadsCount,  updateLeads } from "../controllers/leadController.js"

export const leadRoute = Router()

leadRoute.post("/" , createLead)
leadRoute.get("/" , getAllLeads)
leadRoute.get("/count" , getLeadsCount )
leadRoute.patch("/" , updateLeads)

