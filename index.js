import express from "express"
import { connectDB } from "./config/db.js"
import "dotenv/config"
import userRoute from "./routes/userRoute.js"
import cors from "cors";

const app = express()

app.use(express.json())
app.use(cors({}))

app.use("/api/user", userRoute)

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