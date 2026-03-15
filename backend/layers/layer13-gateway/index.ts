/**
 * Layer 13: API Gateway Middleware
 * Centralized routing, authentication, and request handling
 */

import express, { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import slowDown from "express-slow-down";
import hpp from "hpp";

// ═══════════════════════════════════════════════════════════════════════════════
// SECURITY MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════════

export const securityMiddleware = [
  // Helmet for security headers
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }),

  // Prevent HTTP Parameter Pollution
  hpp(),
];

// ═══════════════════════════════════════════════════════════════════════════════
// RATE LIMITING
// ═══════════════════════════════════════════════════════════════════════════════

export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: "Too many requests",
    message: "Please try again later",
    retryAfter: "15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 50,
  delayMs: (hits) => hits * 100,
});

// ═══════════════════════════════════════════════════════════════════════════════
// API GATEWAY ROUTER
// ═══════════════════════════════════════════════════════════════════════════════

export const gatewayRouter = express.Router();

// Health check
gatewayRouter.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "healthy",
    layer: "gateway",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

// Gateway status
gatewayRouter.get("/status", (req: Request, res: Response) => {
  res.json({
    gateway: "active",
    security: "helmet-enabled",
    rateLimit: "100/15min",
    slowDown: "after-50-requests",
  });
});

// Request logging middleware
export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(
      `[GATEWAY] ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`,
    );
  });

  next();
};

export default {
  securityMiddleware,
  rateLimiter,
  speedLimiter,
  gatewayRouter,
  requestLogger,
};
