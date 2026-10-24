// Central error handler: always returns { success: false, message }
const errorMiddleware = (err, req, res, next) => {
  let status = err.status || 500;
  let message = err.message || "Server error";

  if (err.name === "ValidationError") {
    status = 400;
    message = Object.values(err.errors).map((e) => e.message).join(". ");
  } else if (err.code === 11000) {
    status = 409;
    message = `${Object.keys(err.keyValue || {})[0] || "Value"} already exists`;
  } else if (err.name === "CastError") {
    status = 400;
    message = "Invalid id or value";
  }

  // Never leak internals in production
  if (status === 500 && process.env.NODE_ENV === "production") message = "Something went wrong";
  if (status === 500) console.error(err);

  const body = { success: false, message };
  if (err.code && typeof err.code === "string") body.code = err.code;
  if (process.env.NODE_ENV !== "production" && status === 500) body.stack = err.stack;
  res.status(status).json(body);
};
export default errorMiddleware;
