import ApiError from "../utils/ApiError.js";

// authorize("admin", "hr") -> only these roles may continue
const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) return next(new ApiError(403, "You do not have permission to do this"));
  next();
};
export default authorize;
