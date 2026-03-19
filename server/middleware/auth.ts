import type { Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { User } from "@prisma/client";
import "express-session";

declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}

// Custom request type to include authenticated user
export interface AuthRequest extends Request {
  user?: User;
}

// Auth middleware
export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    req.user = user;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const requireRole = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };
};
