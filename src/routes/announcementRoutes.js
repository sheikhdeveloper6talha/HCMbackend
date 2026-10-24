import express from "express";
import * as c from "../controllers/announcementController.js";
import { protect } from "../middleware/authMiddleware.js";
import authorize from "../middleware/roleMiddleware.js";
import validate from "../middleware/validateMiddleware.js";

const router = express.Router();

router.use(protect);
router.get("/", c.list);
router.post("/", authorize("admin", "hr"), validate([{ field: "title", required: true }, { field: "message", required: true }]), c.create);
router.delete("/:id", authorize("admin", "hr"), c.remove);
export default router;
