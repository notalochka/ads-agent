import { Router } from "express";
import { executeResearch } from "../services/research.service.js";

export const researchRouter = Router();

/**
 * POST /api/research
 * Runs the competitor ads intelligence agent and returns JSON + markdown summary.
 */
researchRouter.post("/", async (req, res, next) => {
  try {
    const payload = await executeResearch(req.body);
    res.status(200).json(payload);
  } catch (error) {
    next(error);
  }
});
