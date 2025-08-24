import {Router} from  "express"
import { createLead, getAllLeads } from "../controllers/leadController.js"

export const leadRoute = Router()

leadRoute.post("/" , createLead)
leadRoute.get("/" , getAllLeads)

