import express from "express";
import * as c from "../controllers/leaveController.js";
import { protect } from "../middleware/authMiddleware.js";
import authorize from "../middleware/roleMiddleware.js";
import validate from "../middleware/validateMiddleware.js";

const router = express.Router();

router.use(protect);
router.get("/balance", authorize("employee"), c.myBalance);
router.get("/me", authorize("employee"), c.myLeaves);
router.post("/", authorize("employee"), validate([
  { field: "leaveType", required: true }, { field: "startDate", required: true, type: "date" },
  { field: "endDate", required: true, type: "date" }, { field: "reason", required: true, minLength: 3 },
]), c.applyLeave);
router.patch("/:id/cancel", authorize("employee"), c.cancelLeave);
router.get("/", authorize("admin", "hr"), c.listLeaves);
router.patch("/:id/decision", authorize("hr"), validate([{ field: "status", required: true, type: "enum", values: ["approved", "rejected"] }]), c.decideLeave);
export default router;
