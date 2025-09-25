import express from "express"
import { connectDB } from "./config/db.js"
import "dotenv/config"
import userRoute from "./routes/userRoute.js"
import cors from "cors";
import courseRoute from "./routes/courseRoute.js";
import discountRouter from "./routes/discountRoute.js";
import { leadRoute } from "./routes/leadRoute.js";
import { createFileName, getAllFileNames } from "./controllers/fileHistoryController.js";
import { getLeaderboards } from "./controllers/leaderboardController.js";
import dashboardRoute from "./routes/dashboard.js";

const app = express()

app.use(express.json({limit:"20mb"}))
app.use(cors({}))

app.use("/api/user", userRoute)
app.use("/api/course" , courseRoute)
app.use("/api/discount" , discountRouter)
app.use("/api/leads" , leadRoute)
app.use("/api/dashboard" , dashboardRoute)
app.post("/api/file" , createFileName)
app.get("/api/file" , getAllFileNames)

app.get("/", (req, res) => {
    res.send("Server is running ✅");
});


await connectDB(process.env.MONGODB_URI)


let isConnected = false
app.use(async (req, res, next) => {
    if (!isConnected) {
        await connectDB(process.env.MONGODB_URI)
        isConnected = true
    }
    next();

})

app.listen(3001, () => {
    console.log("server running on localhost 3001")
})


export default app ;