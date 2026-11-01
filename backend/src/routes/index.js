import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getHealth, getPublicConfig } from "../controllers/healthController.js";
import { getEvents } from "../controllers/eventController.js";
import { getParticipant } from "../controllers/participantController.js";
import { getHistory, getProduct, getScans, postScan, readVerification } from "../controllers/productController.js";

export const router = Router();

router.get("/health", asyncHandler(getHealth));
router.get("/config", asyncHandler(getPublicConfig));
router.get("/events", asyncHandler(getEvents));
router.get("/participants/:address", asyncHandler(getParticipant));
router.get("/products/:productId", asyncHandler(getProduct));
router.get("/products/:productId/history", asyncHandler(getHistory));
router.get("/products/:productId/verify", asyncHandler(readVerification));
router.get("/products/:productId/scans", asyncHandler(getScans));
router.post("/products/scan", asyncHandler(postScan));
