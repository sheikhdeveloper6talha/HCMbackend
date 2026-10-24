import Company from "../models/Company.js";
import Department from "../models/Department.js";
import Designation from "../models/Designation.js";
import LeaveType from "../models/LeaveType.js";
import Holiday from "../models/Holiday.js";
import Employee from "../models/Employee.js";
import LeaveRequest from "../models/LeaveRequest.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { getCompany } from "../services/companyService.js";
import { logAudit } from "../services/auditService.js";

const readCompany = asyncHandler(async (req, res) => res.json({ success: true, data: await getCompany() }));

const updateCompany = asyncHandler(async (req, res) => {
  const company = await getCompany();
  const before = company.toObject();
  const fields = ["name", "officeStart", "graceMinutes", "halfDayHours", "weekends", "locationRequired", "officeLat", "officeLng", "radiusMeters", "currency"];
  fields.forEach((f) => { if (req.body[f] !== undefined) company[f] = req.body[f]; });
  await company.save();
  await logAudit(req.user, "update", "Company", company._id, before, company.toObject());
  res.json({ success: true, data: company });
});

// One small factory builds list/create/update/delete for the four setup lists
const makeCrud = (Model, label, fields, sort, inUse) => ({
  list: asyncHandler(async (req, res) => res.json({ success: true, data: await Model.find().sort(sort) })),
  create: asyncHandler(async (req, res) => {
    const body = Object.fromEntries(fields.filter((f) => req.body[f] !== undefined).map((f) => [f, req.body[f]]));
    const doc = await Model.create(body);
    await logAudit(req.user, "create", label, doc._id, null, body);
    res.status(201).json({ success: true, data: doc });
  }),
  update: asyncHandler(async (req, res) => {
    const doc = await Model.findById(req.params.id);
    if (!doc) throw new ApiError(404, `${label} not found`);
    const before = doc.toObject();
    fields.forEach((f) => { if (req.body[f] !== undefined) doc[f] = req.body[f]; });
    await doc.save();
    await logAudit(req.user, "update", label, doc._id, before, doc.toObject());
    res.json({ success: true, data: doc });
  }),
  remove: asyncHandler(async (req, res) => {
    const doc = await Model.findById(req.params.id);
    if (!doc) throw new ApiError(404, `${label} not found`);
    if (inUse && (await inUse(doc._id))) throw new ApiError(400, `${label} is in use and cannot be deleted`);
    await doc.deleteOne();
    await logAudit(req.user, "delete", label, doc._id, doc.toObject(), null);
    res.json({ success: true, message: "Deleted" });
  }),
});

const departments = makeCrud(Department, "Department", ["name"], "name", (id) => Employee.exists({ department: id }));
const designations = makeCrud(Designation, "Designation", ["name"], "name", (id) => Employee.exists({ designation: id }));
const leaveTypes = makeCrud(LeaveType, "LeaveType", ["name", "annualQuota", "paid"], "name", (id) => LeaveRequest.exists({ leaveType: id }));
const holidays = makeCrud(Holiday, "Holiday", ["name", "date"], "date");

export { readCompany, updateCompany, departments, designations, leaveTypes, holidays };
