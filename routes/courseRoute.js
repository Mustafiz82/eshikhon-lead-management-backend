import { Router } from "express"
import { createCource, deleteCource, listCources, syncCourse, updateCource } from "../controllers/courseController.js"

const courseRoute = Router()

courseRoute.post("/" , createCource) 
courseRoute.get("/" , listCources) 
courseRoute.put("/:id" , updateCource) 
courseRoute.delete("/:id" , deleteCource) 
courseRoute.get("/sync" , syncCourse) 


export  default courseRoute