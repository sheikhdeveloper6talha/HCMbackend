import express from "express";
import * as c from "../controllers/companyController.js";
import { protect } from "../middleware/authMiddleware.js";
import authorize from "../middleware/roleMiddleware.js";
import validate from "../middleware/validateMiddleware.js";

const router = express.Router();

router.use(protect);
router.get("/", c.readCompany);
router.put("/", authorize("admin"), validate([
  { field: "name", type: "string" }, { field: "officeStart", type: "time" },
  { field: "graceMinutes", type: "number", min: 0, max: 240 }, { field: "halfDayHours", type: "number", min: 1, max: 12 },
  { field: "radiusMeters", type: "number", min: 10 },
]), c.updateCompany);

const crud = (path, handlers, rules) => {
  router.get(`/${path}`, handlers.list);
  router.post(`/${path}`, authorize("admin"), validate(rules), handlers.create);
  router.put(`/${path}/:id`, authorize("admin"), validate(rules.map((r) => ({ ...r, required: false }))), handlers.update);
  router.delete(`/${path}/:id`, authorize("admin"), handlers.remove);
};
crud("departments", c.departments, [{ field: "name", required: true }]);
crud("designations", c.designations, [{ field: "name", required: true }]);
crud("leave-types", c.leaveTypes, [{ field: "name", required: true }, { field: "annualQuota", type: "number", min: 0 }]);
crud("holidays", c.holidays, [{ field: "name", required: true }, { field: "date", required: true, type: "date" }]);
export default router;
