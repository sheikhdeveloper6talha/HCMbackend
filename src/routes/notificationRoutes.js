import express from "express";
import * as c from "../controllers/notificationController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);
router.get("/", c.list);
router.patch("/read-all", c.markAllRead);
router.patch("/:id/read", c.markRead);
export default router;
