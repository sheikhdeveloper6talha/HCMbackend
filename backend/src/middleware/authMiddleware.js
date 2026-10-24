import jwt from "jsonwebtoken";
import User from "../models/User.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";

const verify = async (req, allowTemp) => {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) throw new ApiError(401, "Not authenticated");
  let payload;
  try {
    payload = jwt.verify(header.split(" ")[1], process.env.JWT_SECRET);
  } catch {
    throw new ApiError(401, "Session expired, please log in again");
  }
  const user = await User.findById(payload.id);
  if (!user || !user.isActive) throw new ApiError(401, "Account not found or deactivated");
  if (user.mustChangePassword && !allowTemp)
    throw new ApiError(403, "You must change your temporary password first", "PASSWORD_CHANGE_REQUIRED");
  req.user = user;
};

// Normal protected routes
const protect = asyncHandler(async (req, res, next) => {
  await verify(req, false);
  next();
});

// Used only for /me and /change-password so a first-time user can reach them
const protectAllowTemp = asyncHandler(async (req, res, next) => {
  await verify(req, true);
  next();
});

export { protect, protectAllowTemp };
