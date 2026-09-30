import { Server as SocketIOServer, type Socket } from "socket.io";
import { type Server as HTTPServer } from "http";
import type { RequestHandler } from "express";
import { getEffectiveDeploymentConfig } from "./utils/deployment-config";
import { storage } from "./storage";

let io: SocketIOServer;

export async function validateSocketSession(socket: Socket): Promise<string | null> {
  let session = (socket.request as any).session;
  if (!session?.userId) return null;
  try {
    await new Promise<void>((resolve,reject)=>session.reload((error: Error | null)=>error?reject(error):resolve()));
    session = (socket.request as any).session;
    if (!session?.userId) return null;
    if (session.cookie?.expires && new Date(session.cookie.expires).getTime() <= Date.now()) return null;
    const user = await storage.getUser(session.userId);
    if (!user || user.isActive === false || (session.sessionVersion ?? 0) !== (user.sessionVersion ?? 0)) return null;
    return user.id;
  } catch { return null; }
}

export function setupSocket(httpServer: HTTPServer, sessionMiddleware: RequestHandler) {
  const config = getEffectiveDeploymentConfig();
  io = new SocketIOServer(httpServer, {
    cors: { origin: config.allowedOrigins, methods: ["GET", "POST"], credentials: true },
    allowRequest: (req, callback) => callback(null, !req.headers.origin || config.allowedOrigins.includes(req.headers.origin)),
  });
  io.engine.use(sessionMiddleware);
  io.use(async (socket,next)=>{
    const userId=await validateSocketSession(socket);
    if (!userId) return next(new Error("Unauthorized"));
    socket.data.userId=userId;next();
  });
  io.on("connection", socket=>{
    socket.join(`user_${socket.data.userId}`);
    const check=async()=> {
      if (await validateSocketSession(socket) !== socket.data.userId) socket.disconnect(true);
    };
    const timer=setInterval(check,30000);timer.unref();
    socket.use(async (_packet,next)=>{
      if (await validateSocketSession(socket) !== socket.data.userId) { socket.disconnect(true); return; }
      next();
    });
    socket.on("joinUserRoom",(userId:string)=>{
      if (userId !== socket.data.userId) return socket.disconnect(true);
      socket.join(`user_${userId}`);
    });
    socket.on("disconnect",()=>clearInterval(timer));
  });
  return io;
}

export function disconnectUserSockets(userId: string) {
  io?.in(`user_${userId}`).disconnectSockets(true);
}
export function disconnectSessionSockets(sessionId: string) {
  if (!io) return;
  for (const socket of io.sockets.sockets.values()) {
    if ((socket.request as any).sessionID === sessionId) socket.disconnect(true);
  }
}
export function getIO(): SocketIOServer {
  if (!io) throw new Error("Socket.io has not been initialized yet!");
  return io;
}
