import { Router } from "express";
import { prisma } from "../db";
import { cached } from "../cache";

export const statsRouter = Router();

// Public, unauthenticated: the real number of registered users. Cached 60s.
// This is the genuine count from the database — it grows only as real people
// sign up.
statsRouter.get("/", async (_req, res, next) => {
  try {
    const users = await cached("stats:users", 60_000, () => prisma.user.count());
    res.json({ users });
  } catch (err) {
    next(err);
  }
});
