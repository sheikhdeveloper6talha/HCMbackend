import Company from "../models/Company.js";
import Holiday from "../models/Holiday.js";
import ApiError from "../utils/ApiError.js";

const getCompany = async () => {
  const company = await Company.findOne();
  if (!company) throw new ApiError(400, "Company is not set up yet");
  return company;
};

const getHolidaySet = async (start, end) => {
  const list = await Holiday.find({ date: { $gte: start, $lte: end } });
  return new Set(list.map((h) => h.date));
};
export { getCompany, getHolidaySet };
