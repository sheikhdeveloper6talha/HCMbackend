import User from "../models/User.js";
import Company from "../models/Company.js";
import LeaveType from "../models/LeaveType.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import generateToken from "../utils/generateToken.js";
import { logAudit } from "../services/auditService.js";

const userPayload = (u) => ({ id: u._id, name: u.name, email: u.email, role: u.role, mustChangePassword: u.mustChangePassword, employee: u.employee });

const setupStatus = asyncHandler(async (req, res) => {
  const count = await User.countDocuments();
  res.json({ success: true, data: { needsSetup: count === 0 } });
});

// First run only: creates the company, default leave types and the first admin
const setup = asyncHandler(async (req, res) => {
  if ((await User.countDocuments()) > 0) throw new ApiError(403, "Setup is already complete");
  const { companyName, name, email, password } = req.body;
  const company = await Company.create({ name: companyName });
  await LeaveType.insertMany([
    { name: "Casual", annualQuota: 10, paid: true },
    { name: "Sick", annualQuota: 8, paid: true },
    { name: "Annual", annualQuota: 14, paid: true },
    { name: "Unpaid", annualQuota: 0, paid: false },
  ]);
  const admin = await User.create({ name, email, password, role: "admin" });
  await logAudit(admin, "setup", "Company", company._id, null, { name: companyName });
  res.status(201).json({ success: true, data: { token: generateToken(admin._id), user: userPayload(admin) } });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: email.toLowerCase() }).select("+password");
  if (!user || !(await user.matchPassword(password))) throw new ApiError(401, "Invalid email or password");
  if (!user.isActive) throw new ApiError(403, "This account is deactivated. Contact your administrator");
  res.json({ success: true, data: { token: generateToken(user._id), user: userPayload(user) } });
});

const me = asyncHandler(async (req, res) => res.json({ success: true, data: userPayload(req.user) }));

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select("+password");
  if (!(await user.matchPassword(currentPassword))) throw new ApiError(400, "Current password is incorrect");
  if (currentPassword === newPassword) throw new ApiError(400, "New password must be different");
  user.password = newPassword;
  user.mustChangePassword = false;
  await user.save();
  await logAudit(user, "change_password", "User", user._id);
  res.json({ success: true, message: "Password changed", data: userPayload(user) });
});

export { setupStatus, setup, login, me, changePassword, userPayload };
