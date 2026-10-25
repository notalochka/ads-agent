import { Router } from "express";
import { getAppStatus } from "../services/status.service.js";

export const statusRouter = Router();

/**
 * GET /api/status
 * Query: ?live=1 – optional cheap live credential ping (no Actor / no generateContent)
 */
statusRouter.get("/", async (req, res, next) => {
  try {
    const live =
      req.query.live === "1" ||
      req.query.live === "true" ||
      req.query.live === "yes";
    const status = await getAppStatus(live);
    res.status(200).json(status);
  } catch (error) {
    next(error);
  }
});
