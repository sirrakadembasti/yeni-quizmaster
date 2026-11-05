import type { Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { logger } from "../utils/logger";
import { User } from "@prisma/client";
import "express-session";

declare module "express-session" {
  interface SessionData {
    userId: string;
    sessionVersion?: number;
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
      return res.status(401).json({ message: "Oturum açmanız gerekiyor." });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || (user as any).isActive === false) {
      if ((user as any)?.isActive === false) req.session.destroy(() => undefined);
      return res.status(401).json({ message: "Kullanıcı bulunamadı." });
    }
    if ((req.session.sessionVersion ?? 0) !== (user.sessionVersion ?? 0)) {
      req.session.destroy?.(() => undefined);
      return res.status(401).json({ message: "Şifreniz veya yetkiniz değişti. Yeniden giriş yapın." });
    }
    req.user = user;
    next();
  } catch (error) {
    logger.error({ err: error }, "[Auth] requireAuth middleware hatası.");
    res.status(500).json({ message: "Dahili sunucu hatası." });
  }
};

export const requireRole = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Bu işlemi yapmak için yetkiniz yok." });
    }
    next();
  };
};
