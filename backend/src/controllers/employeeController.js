import Employee from "../models/Employee.js";
import User from "../models/User.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { getPaging, pageMeta } from "../utils/paginate.js";
import { logAudit } from "../services/auditService.js";
import { tempPassword } from "./userController.js";

const populate = [{ path: "department", select: "name" }, { path: "designation", select: "name" }];
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildFilter = (q) => {
  const filter = {};
  if (q.search) {
    const rx = new RegExp(escapeRegex(q.search), "i");
    filter.$or = [{ name: rx }, { email: rx }, { code: rx }];
  }
  ["department", "designation", "status"].forEach((k) => { if (q[k]) filter[k] = q[k]; });
  return filter;
};

const listEmployees = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPaging(req.query);
  const filter = buildFilter(req.query);
  const [items, total] = await Promise.all([
    Employee.find(filter).populate(populate).sort("name").skip(skip).limit(limit),
    Employee.countDocuments(filter),
  ]);
  res.json({ success: true, data: items, meta: pageMeta(total, page, limit) });
});

// Options for dropdowns (no pagination, minimal fields)
const employeeOptions = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await Employee.find({ status: "active" }).select("name code").sort("name") });
});

const getMe = asyncHandler(async (req, res) => {
  if (!req.user.employee) throw new ApiError(404, "No employee profile for this account");
  res.json({ success: true, data: await Employee.findById(req.user.employee).populate(populate) });
});

const getEmployee = asyncHandler(async (req, res) => {
  // Data scope: an employee may only read their own record
  if (req.user.role === "employee" && String(req.user.employee) !== req.params.id) throw new ApiError(403, "You can only view your own profile");
  const emp = await Employee.findById(req.params.id).populate(populate);
  if (!emp) throw new ApiError(404, "Employee not found");
  res.json({ success: true, data: emp });
});

const createEmployee = asyncHandler(async (req, res) => {
  const { name, email, code, phone, address, department, designation, joiningDate } = req.body;
  if (await Employee.exists({ code })) throw new ApiError(409, "employee code already exists");
  if (await User.exists({ email: email.toLowerCase() })) throw new ApiError(409, "email already exists");

  const password = tempPassword();
  const user = await User.create({ name, email, password, role: "employee", mustChangePassword: true });
  try {
    const emp = await Employee.create({ user: user._id, name, email, code, phone, address, department, designation, joiningDate });
    user.employee = emp._id;
    await user.save();
    await logAudit(req.user, "create", "Employee", emp._id, null, { name, email, code });
    res.status(201).json({ success: true, data: emp, temporaryPassword: password });
  } catch (err) {
    await User.findByIdAndDelete(user._id); // roll back the login if the profile failed
    throw err;
  }
});

const updateEmployee = asyncHandler(async (req, res) => {
  const emp = await Employee.findById(req.params.id);
  if (!emp) throw new ApiError(404, "Employee not found");
  const before = emp.toObject();
  const fields = ["name", "email", "code", "phone", "address", "department", "designation", "joiningDate", "leavingDate", "status"];
  fields.forEach((f) => { if (req.body[f] !== undefined) emp[f] = req.body[f] === "" ? undefined : req.body[f]; });
  await emp.save();

  // Keep the login in sync
  const user = await User.findById(emp.user);
  if (user) {
    user.name = emp.name;
    user.email = emp.email;
    user.isActive = emp.status === "active";
    await user.save();
  }
  await logAudit(req.user, "update", "Employee", emp._id, before, emp.toObject());
  res.json({ success: true, data: emp });
});

// Employees can only change their own phone and address
const updateContact = asyncHandler(async (req, res) => {
  const emp = await Employee.findById(req.user.employee);
  if (!emp) throw new ApiError(404, "Employee profile not found");
  const before = { phone: emp.phone, address: emp.address };
  if (req.body.phone !== undefined) emp.phone = req.body.phone;
  if (req.body.address !== undefined) emp.address = req.body.address;
  await emp.save();
  await logAudit(req.user, "update_contact", "Employee", emp._id, before, { phone: emp.phone, address: emp.address });
  res.json({ success: true, data: emp });
});

const exportCsv = asyncHandler(async (req, res) => {
  const items = await Employee.find(buildFilter(req.query)).populate(populate).sort("code");
  const cell = (v) => `"${String(v ?? "").replace(/"/g, "\"\"")}"`;
  const rows = [["Code", "Name", "Email", "Phone", "Department", "Designation", "Joining Date", "Status"]];
  items.forEach((e) => rows.push([e.code, e.name, e.email, e.phone, e.department?.name, e.designation?.name, e.joiningDate, e.status]));
  res.header("Content-Type", "text/csv").attachment("employees.csv").send(rows.map((r) => r.map(cell).join(",")).join("\n"));
});

export { listEmployees, employeeOptions, getMe, getEmployee, createEmployee, updateEmployee, updateContact, exportCsv };
