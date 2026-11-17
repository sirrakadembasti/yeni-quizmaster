import type { NextFunction, Request, Response } from "express";
import { logger } from "../utils/logger";

export function apiErrorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  const status = err.status || err.statusCode || 500;
  const message = status >= 500 ? "Dahili Sunucu Hatası" : (err.message || "Dahili Sunucu Hatası");

  logger.error({
    err,
    status,
    message,
    path: req.path,
    method: req.method
  }, "API Error");

  if (req.path.startsWith("/api")) {
    return res.status(status).json({ message });
  }
  _next(err);
}
