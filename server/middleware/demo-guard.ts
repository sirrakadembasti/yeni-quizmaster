import type { NextFunction, Request, Response } from "express";
import { storage } from "../storage";
import {
  DEMO_READ_ONLY_CODE,
  DEMO_READ_ONLY_MESSAGE,
  isDemoInstanceEnabled,
  isDemoShowcaseEmail,
} from "../utils/demo-mode";

declare module "express-session" {
  interface SessionData {
    isDemoSession?: boolean;
  }
}

const ALLOWED_DEMO_POST_PATHS = new Set([
  "/api/auth/login",
  "/api/auth/demo-login",
  "/api/auth/logout",
  "/api/admin/academic-history/context",
]);

export function isRefererFromDemoPath(referer: string | undefined): boolean {
  if (!referer) return false;
  try {
    const parsed = new URL(referer, "http://localhost");
    return parsed.pathname === "/demo" || parsed.pathname.startsWith("/demo/");
  } catch {
    return false;
  }
}

export function isRequestInDemoContext(req: Request): boolean {
  if (isDemoInstanceEnabled()) return true;
  const headerFlag = String(req.headers["x-quizmaster-demo"] || "").trim().toLowerCase();
  if (headerFlag === "1" || headerFlag === "true") return true;
  if (req.session?.isDemoSession === true) return true;
  if (isRefererFromDemoPath(req.get("referer"))) return true;
  return false;
}

export function demoRequestPolicy(method: string, rawPath: string): number | null {
  const normalizedMethod = String(method || "GET").toUpperCase();
  if (["GET", "HEAD", "OPTIONS"].includes(normalizedMethod)) {
    return null;
  }

  const normalizedPath = String(rawPath || "")
    .split("?")[0]
    .toLowerCase()
    .replace(/\/$/, "");

  if (!normalizedPath.startsWith("/api/")) {
    return null;
  }

  if (normalizedMethod === "POST" && ALLOWED_DEMO_POST_PATHS.has(normalizedPath)) {
    return null;
  }

  return 403;
}

export function createDemoModeGuard() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const policyStatus = demoRequestPolicy(req.method, req.path);
    if (policyStatus === null) {
      return next();
    }

    if (isRequestInDemoContext(req)) {
      return res.status(policyStatus).json({
        code: DEMO_READ_ONLY_CODE,
        message: DEMO_READ_ONLY_MESSAGE,
      });
    }

    const sessionUserId = req.session?.userId;
    if (!sessionUserId) {
      return next();
    }

    try {
      const user = await storage.getUser(sessionUserId);
      if (user && isDemoShowcaseEmail(user.email)) {
        return res.status(policyStatus).json({
          code: DEMO_READ_ONLY_CODE,
          message: DEMO_READ_ONLY_MESSAGE,
        });
      }
    } catch {
      // Fall through to standard route error handling if storage lookup fails
    }

    return next();
  };
}
