import type { NextFunction, Request, RequestHandler, Response } from "express";

export const asyncRoute = <Req extends Request = Request>(
  handler: (req: Req, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler => (req, res, next) => { handler(req as Req, res, next).catch(next); };
