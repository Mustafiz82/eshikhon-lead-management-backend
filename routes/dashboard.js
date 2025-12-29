import express from "express"
import { getAdminLeadStats, getAgentleadState, getCourseSellingSummary, getDailyCallCount, getLeaderboards, getLeadsGrowth } from "../controllers/leaderboardController.js"
const dashboardRoute = express.Router()


dashboardRoute.get("/leaderboards" , getLeaderboards)
dashboardRoute.get("/admin" , getAdminLeadStats)
dashboardRoute.get("/agent" , getAgentleadState)
dashboardRoute.get("/leadGrowth" , getLeadsGrowth)
dashboardRoute.get("/getDailyCallCount" , getDailyCallCount)
dashboardRoute.get("/courseSellingSummary" , getCourseSellingSummary)


export default dashboardRoute



