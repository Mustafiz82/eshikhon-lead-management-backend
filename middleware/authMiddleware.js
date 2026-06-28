import jwt from "jsonwebtoken";
import User from "../models/user.js"; 


export const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;

  // Debug logs to confirm in your backend terminal
  // console.log("Parsed Cookies on Backend:", req.cookies);
  // console.log("Token value found:", token);

  if (!token) {
    return res.status(401).json({ error: "Access Denied: No Token Provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "fallback_secret_key");
    req.user = decoded; 
    next();
  } catch (error) {
    return res.status(403).json({ error: "Access Denied: Invalid or Expired Token" });
  }
};

export const verifyAdmin = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: "Access Denied: Authentication required" });
    }

    // Retrieve fresh user document from MongoDB/Mongoose
    const dbUser = await User.findById(req.user.id);

    if (!dbUser) {
      return res.status(404).json({ error: "Access Denied: User not found" });
    }

    // Confirm their role directly from the database record
    if (dbUser.role !== "admin") {
      return res.status(403).json({ error: "Access Denied: Admin privileges required" });
    }

    next(); // Move to the controller
  } catch (error) {
    return res.status(500).json({ error: "Internal server error during authorization" });
  }
};