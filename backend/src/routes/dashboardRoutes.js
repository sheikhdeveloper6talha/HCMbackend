import express from "express";
import * as c from "../controllers/dashboardController.js";
import { protect } from "../middleware/authMiddleware.js";
import authorize from "../middleware/roleMiddleware.js";

const router = express.Router();

router.use(protect);
router.get("/admin", authorize("admin"), c.admin);
router.get("/hr", authorize("admin", "hr"), c.hr);
router.get("/employee", authorize("employee"), c.employee);
export default router;
