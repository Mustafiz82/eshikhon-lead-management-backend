import express from "express"
import { createUser, deleteUser, getAllUser, getUser, login, updateUser } from "../controllers/userController.js"
const userRoute = express.Router()


userRoute.post("/login", login )
userRoute.post("/" , createUser)
userRoute.get("/" , getAllUser)
userRoute.get("/:id" ,getUser)
userRoute.put("/:id" , updateUser )
userRoute.delete("/:id" , deleteUser)




export default userRoute