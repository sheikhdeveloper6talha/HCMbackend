import crypto from "crypto";
import User from "../models/User.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { logAudit } from "../services/auditService.js";

const tempPassword = () => `${crypto.randomBytes(6).toString("base64url")}#7a`;

// Admin manages HR (and can see employees); HR manages employee logins only
const manageable = (actor) => (actor.role === "admin" ? ["hr", "employee"] : ["employee"]);

const listUsers = asyncHandler(async (req, res) => {
  const roles = manageable(req.user);
  const role = roles.includes(req.query.role) ? req.query.role : roles[0];
  const users = await User.find({ role }).sort("name");
  res.json({ success: true, data: users });
});

const createHr = asyncHandler(async (req, res) => {
  const { name, email } = req.body;
  if (await User.exists({ email: email.toLowerCase() })) throw new ApiError(409, "email already exists");
  const password = tempPassword();
  const user = await User.create({ name, email, password, role: "hr", mustChangePassword: true });
  await logAudit(req.user, "create", "User(HR)", user._id, null, { name, email });
  res.status(201).json({ success: true, data: user, temporaryPassword: password });
});

const loadTarget = async (req) => {
  const target = await User.findById(req.params.id);
  if (!target) throw new ApiError(404, "User not found");
  if (!manageable(req.user).includes(target.role)) throw new ApiError(403, "You cannot manage this account");
  return target;
};

const setStatus = asyncHandler(async (req, res) => {
  const target = await loadTarget(req);
  const before = { isActive: target.isActive };
  target.isActive = req.body.isActive;
  await target.save();
  await logAudit(req.user, target.isActive ? "activate" : "deactivate", "User", target._id, before, { isActive: target.isActive });
  res.json({ success: true, data: target });
});

const resetPassword = asyncHandler(async (req, res) => {
  const target = await loadTarget(req);
  const password = tempPassword();
  target.password = password;
  target.mustChangePassword = true;
  await target.save();
  await logAudit(req.user, "reset_password", "User", target._id);
  res.json({ success: true, message: "Password reset", temporaryPassword: password });
});

export { listUsers, createHr, setStatus, resetPassword, tempPassword };
