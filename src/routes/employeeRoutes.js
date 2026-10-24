import express from "express";
import * as c from "../controllers/employeeController.js";
import { protect } from "../middleware/authMiddleware.js";
import authorize from "../middleware/roleMiddleware.js";
import validate from "../middleware/validateMiddleware.js";

const router = express.Router();

router.use(protect);
router.get("/", authorize("admin", "hr"), c.listEmployees);
router.get("/options", authorize("admin", "hr"), c.employeeOptions);
router.get("/export", authorize("admin", "hr"), c.exportCsv);
router.get("/me", authorize("employee"), c.getMe);
router.put("/me/contact", authorize("employee"), c.updateContact);
router.get("/:id", c.getEmployee); // scope checked inside the controller
router.post("/", authorize("hr"), validate([
  { field: "name", required: true }, { field: "email", required: true, type: "email" }, { field: "code", required: true },
  { field: "department", required: true }, { field: "designation", required: true },
  { field: "joiningDate", required: true, type: "date" }, { field: "leavingDate", type: "date" },
]), c.createEmployee);
router.put("/:id", authorize("hr"), validate([
  { field: "email", type: "email" }, { field: "joiningDate", type: "date" }, { field: "leavingDate", type: "date" },
  { field: "status", type: "enum", values: ["active", "inactive"] },
]), c.updateEmployee);
export default router;
