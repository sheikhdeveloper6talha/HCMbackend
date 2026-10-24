import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import * as svc from "../services/dashboardService.js";

const admin = asyncHandler(async (req, res) => res.json({ success: true, data: await svc.adminDashboard(req.query) }));
const hr = asyncHandler(async (req, res) => res.json({ success: true, data: await svc.hrDashboard(req.query) }));
const employee = asyncHandler(async (req, res) => {
  if (!req.user.employee) throw new ApiError(403, "Only employees have this dashboard");
  res.json({ success: true, data: await svc.employeeDashboard(req.user.employee) });
});
export { admin, hr, employee };
