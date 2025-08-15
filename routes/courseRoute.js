import { Router } from "express"
import { createCource, deleteCource, listCources, updateCource } from "../controllers/courseController.js"

const courseRoute = Router()

courseRoute.post("/" , createCource) 
courseRoute.get("/" , listCources) 
courseRoute.put("/:id" , updateCource) 
courseRoute.delete("/:id" , deleteCource) 


export  default courseRoute