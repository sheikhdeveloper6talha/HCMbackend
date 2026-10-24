import express from "express";
import * as c from "../controllers/authController.js";
import * as u from "../controllers/userController.js";
import { protect, protectAllowTemp } from "../middleware/authMiddleware.js";
import authorize from "../middleware/roleMiddleware.js";
import validate from "../middleware/validateMiddleware.js";

const router = express.Router();

router.get("/setup-status", c.setupStatus);
router.post("/setup", validate([
  { field: "companyName", required: true }, { field: "name", required: true },
  { field: "email", required: true, type: "email" }, { field: "password", required: true, minLength: 8 },
]), c.setup);
router.post("/login", validate([{ field: "email", required: true, type: "email" }, { field: "password", required: true }]), c.login);
router.get("/me", protectAllowTemp, c.me);
router.put("/change-password", protectAllowTemp, validate([
  { field: "currentPassword", required: true }, { field: "newPassword", required: true, minLength: 8 },
]), c.changePassword);

// Account management (HR accounts by Admin, employee logins by HR)
router.get("/users", protect, authorize("admin", "hr"), u.listUsers);
router.post("/users/hr", protect, authorize("admin"), validate([{ field: "name", required: true }, { field: "email", required: true, type: "email" }]), u.createHr);
router.patch("/users/:id/status", protect, authorize("admin", "hr"), validate([{ field: "isActive", required: true, type: "boolean" }]), u.setStatus);
router.post("/users/:id/reset-password", protect, authorize("admin", "hr"), u.resetPassword);
export default router;
