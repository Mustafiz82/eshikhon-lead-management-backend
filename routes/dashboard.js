import express from "express"
import { getAdminLeadStats, getAgentleadState, getDailyCallCount, getLeaderboards, getLeadsGrowth } from "../controllers/leaderboardController.js"
const dashboardRoute = express.Router()


dashboardRoute.get("/leaderboards" , getLeaderboards)
dashboardRoute.get("/admin" , getAdminLeadStats)
dashboardRoute.get("/agent" , getAgentleadState)
dashboardRoute.get("/leadGrowth" , getLeadsGrowth)
dashboardRoute.get("/getDailyCallCount" , getDailyCallCount)


export default dashboardRoute



