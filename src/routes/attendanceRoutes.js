import express from "express";
import * as c from "../controllers/attendanceController.js";
import { protect } from "../middleware/authMiddleware.js";
import authorize from "../middleware/roleMiddleware.js";
import validate from "../middleware/validateMiddleware.js";

const router = express.Router();

router.use(protect);
// Employee
router.post("/check-in", authorize("employee"), c.checkIn);
router.post("/check-out", authorize("employee"), c.checkOut);
router.get("/me", authorize("employee"), validate([{ field: "month", in: "query", type: "month" }]), c.myCalendar);
router.get("/corrections/me", authorize("employee"), c.myCorrections);
router.post("/corrections", authorize("employee"), validate([
  { field: "date", required: true, type: "date" }, { field: "checkIn", type: "time" }, { field: "checkOut", type: "time" },
  { field: "reason", required: true, minLength: 5 },
]), c.requestCorrection);
// HR / Admin
router.get("/board", authorize("admin", "hr"), validate([{ field: "date", in: "query", type: "date" }]), c.board);
router.get("/corrections", authorize("admin", "hr"), c.listCorrections);
router.patch("/corrections/:id", authorize("hr"), validate([{ field: "status", required: true, type: "enum", values: ["approved", "rejected"] }]), c.decideCorrection);
router.get("/employee/:id", authorize("admin", "hr"), c.employeeCalendar);
export default router;
