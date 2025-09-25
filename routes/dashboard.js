import express from "express"
import { getAdminLeadStats, getDailyCallCount, getLeaderboards, getLeadsGrowth } from "../controllers/leaderboardController.js"
const dashboardRoute = express.Router()


dashboardRoute.get("/leaderboards" , getLeaderboards)
dashboardRoute.get("/admin" , getAdminLeadStats)
dashboardRoute.get("/leadGrowth" , getLeadsGrowth)
dashboardRoute.get("/getDailyCallCount" , getDailyCallCount)


export default dashboardRoute



