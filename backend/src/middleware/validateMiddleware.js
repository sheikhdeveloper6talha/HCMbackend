import ApiError from "../utils/ApiError.js";
import { isValidDate, isValidMonth } from "../utils/dates.js";

// Tiny rule-based validator.
// rules: [{ field, in: "body"|"query"|"params", required, type, values, min, max, minLength }]
const check = (value, rule) => {
  const label = rule.field;
  if (value === undefined || value === null || value === "") return rule.required ? `${label} is required` : null;
  switch (rule.type) {
    case "email":
      return /^\S+@\S+\.\S+$/.test(value) ? null : `${label} must be a valid email`;
    case "number":
      return Number.isFinite(Number(value)) ? checkRange(Number(value), rule) : `${label} must be a number`;
    case "date":
      return isValidDate(String(value)) ? null : `${label} must be a valid date (YYYY-MM-DD)`;
    case "month":
      return isValidMonth(String(value)) ? null : `${label} must be a valid month (YYYY-MM)`;
    case "time":
      return /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? null : `${label} must be a time (HH:mm)`;
    case "boolean":
      return typeof value === "boolean" ? null : `${label} must be true or false`;
    case "enum":
      return rule.values.includes(value) ? null : `${label} must be one of: ${rule.values.join(", ")}`;
    default:
      if (typeof value !== "string") return `${label} must be text`;
      if (rule.minLength && value.length < rule.minLength) return `${label} must be at least ${rule.minLength} characters`;
      return null;
  }
};

const checkRange = (n, rule) => {
  if (rule.min !== undefined && n < rule.min) return `${rule.field} must be at least ${rule.min}`;
  if (rule.max !== undefined && n > rule.max) return `${rule.field} must be at most ${rule.max}`;
  return null;
};

const validate = (rules) => (req, res, next) => {
  const errors = rules.map((r) => check((req[r.in || "body"] || {})[r.field], r)).filter(Boolean);
  if (errors.length) return next(new ApiError(400, errors.join(". ")));
  next();
};

export default validate;
