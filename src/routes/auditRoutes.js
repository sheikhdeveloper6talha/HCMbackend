import express from "express";
import * as c from "../controllers/auditController.js";
import { protect } from "../middleware/authMiddleware.js";
import authorize from "../middleware/roleMiddleware.js";

const router = express.Router();

router.get("/", protect, authorize("admin"), c.list);
export default router;
