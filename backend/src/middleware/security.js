import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { stripDangerousKeys } from "../lib/validate.js";

const isProd = process.env.NODE_ENV === "production";

/** Refuse to start in production without a strong JWT secret */
export function assertProductionSecrets() {
  if (!isProd) return;
  const secret = process.env.JWT_SECRET || "";
  if (!secret || secret.length < 32 || secret === "dev-secret" || secret === "change-me-in-production-use-long-random-string") {
    console.error(
      "[security] Set JWT_SECRET in production (32+ random characters). API will not start safely otherwise.",
    );
    process.exit(1);
  }
}

export const securityHeaders = helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
});

export function sanitizeJsonBody(req, _res, next) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    req.body = stripDangerousKeys(req.body);
  }
  next();
}

/** General API rate limit (per IP) */
export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 400 : 2000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Try again later." },
});

/** Stricter limit for login attempts */
export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 15 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Try again in a few minutes." },
});

/** Hide internal error details in production */
export function safeErrorHandler(err, _req, res, _next) {
  console.error(err);
  res.status(500).json({ error: isProd ? "Internal error" : err?.message || "Internal error" });
}
