import express from "express";
import * as c from "../controllers/payrollController.js";
import { protect } from "../middleware/authMiddleware.js";
import authorize from "../middleware/roleMiddleware.js";
import validate from "../middleware/validateMiddleware.js";

const router = express.Router();

router.use(protect);
router.get("/runs", authorize("admin", "hr"), c.listRuns);
router.post("/runs", authorize("hr"), validate([{ field: "month", required: true, type: "month" }]), c.createRun);
router.get("/runs/:id", authorize("admin", "hr"), c.getRun);
router.patch("/runs/:id/finalize", authorize("admin"), c.finalizeRun);
router.get("/salaries", authorize("admin", "hr"), c.listSalaries);
router.put("/salaries/:employeeId", authorize("hr"), validate([
  { field: "basic", required: true, type: "number", min: 0 }, { field: "hra", type: "number", min: 0 },
  { field: "medical", type: "number", min: 0 }, { field: "other", type: "number", min: 0 },
]), c.setSalary);
router.get("/payslips/me", authorize("employee"), c.myPayslips);
router.get("/payslips/:id/pdf", c.payslipPdf); // access checked inside the controller
export default router;
