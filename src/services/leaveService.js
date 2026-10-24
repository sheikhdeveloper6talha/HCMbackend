import LeaveRequest from "../models/LeaveRequest.js";
import LeaveType from "../models/LeaveType.js";
import ApiError from "../utils/ApiError.js";
import { workingDaysBetween } from "../utils/dates.js";
import { getCompany, getHolidaySet } from "./companyService.js";

const yearOf = (d) => d.slice(0, 4);

// Days already used (approved) or reserved (pending) for one type in a year
const usedDays = async (employeeId, typeId, year, excludeId) => {
  const filter = {
    employee: employeeId, leaveType: typeId,
    status: { $in: ["pending", "approved"] },
    startDate: { $gte: `${year}-01-01`, $lte: `${year}-12-31` },
  };
  if (excludeId) filter._id = { $ne: excludeId };
  const list = await LeaveRequest.find(filter);
  return list.reduce((sum, l) => sum + l.days, 0);
};

const getBalances = async (employeeId, year) => {
  const types = await LeaveType.find().sort("name");
  return Promise.all(
    types.map(async (t) => {
      const used = await usedDays(employeeId, t._id, year);
      return {
        leaveType: { _id: t._id, name: t.name, paid: t.paid },
        quota: t.paid ? t.annualQuota : null,
        used,
        remaining: t.paid ? Math.max(t.annualQuota - used, 0) : null,
      };
    })
  );
};

const validateRequest = async (employeeId, { leaveType, startDate, endDate }, excludeId) => {
  if (endDate < startDate) throw new ApiError(400, "End date cannot be before start date");
  if (yearOf(startDate) !== yearOf(endDate)) throw new ApiError(400, "Leave cannot span two calendar years; split it into two requests");
  const type = await LeaveType.findById(leaveType);
  if (!type) throw new ApiError(400, "Invalid leave type");

  const company = await getCompany();
  const holidays = await getHolidaySet(startDate, endDate);
  const days = workingDaysBetween(startDate, endDate, company.weekends, holidays).length;
  if (days === 0) throw new ApiError(400, "Selected dates contain no working days");

  const overlap = await LeaveRequest.findOne({
    employee: employeeId, status: { $in: ["pending", "approved"] },
    startDate: { $lte: endDate }, endDate: { $gte: startDate },
    ...(excludeId && { _id: { $ne: excludeId } }),
  });
  if (overlap) throw new ApiError(409, "These dates overlap with another leave request");

  if (type.paid) {
    const used = await usedDays(employeeId, type._id, yearOf(startDate), excludeId);
    if (used + days > type.annualQuota)
      throw new ApiError(400, `Not enough ${type.name} balance (remaining ${Math.max(type.annualQuota - used, 0)}, requested ${days})`);
  }
  return days;
};

export { getBalances, validateRequest };
