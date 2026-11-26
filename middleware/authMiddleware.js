import jwt from "jsonwebtoken";
import User from "../models/user.js"; 


export const verifyToken = (req, res, next) => {
  // 1. Check for Google Sheet API Key first
  const apiKey = req.headers["x-api-key"];
  if (apiKey && apiKey === process.env.GSHEET_API_KEY) {
    req.isApiKey = true; // Flag for verifyAdmin
    return next();
  }

  // 2. Normal Cookie/JWT check for your website users
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({ error: "Access Denied: No Token Provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "fallback_secret_key");
    req.user = decoded;
    next();
  } catch (error) {
     return res.status(403).json({
      error: "Access Denied: Invalid or Expired Token",
      reason: error.message, // temporary for debugging
    });
  }
};

export const verifyAdmin = async (req, res, next) => {
  try {
    // Allow through if authenticated via Google Sheet API Key
    if (req.isApiKey) {
      return next();
    }

    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: "Access Denied: Authentication required" });
    }

    const dbUser = await User.findById(req.user.id);
    if (!dbUser) {
      return res.status(404).json({ error: "Access Denied: User not found" });
    }

    if (dbUser.role !== "admin") {
      return res.status(403).json({ error: "Access Denied: Admin privileges required" });
    }

    next();
  } catch (error) {
    return res.status(500).json({ error: "Internal server error during authorization" });
  }
};