import { Server as SocketIOServer } from "socket.io";
import { type Server as HTTPServer } from "http";
import type { RequestHandler } from "express";

let io: SocketIOServer;

/**
 * Socket.IO sunucusunu başlatır.
 *
 * @param sessionMiddleware - Express session middleware'i (index.ts'den paylaşılır).
 *   Bu middleware, socket.request üzerinden session verilerine erişimi sağlar.
 *   Böylece joinUserRoom olayında bağlanan kullanıcının session'daki userId'si doğrulanabilir.
 */
export function setupSocket(httpServer: HTTPServer, sessionMiddleware: RequestHandler) {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.ALLOWED_ORIGINS?.split(",") || ["http://localhost:5173", "http://127.0.0.1:5173"],
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  // Express session middleware'ini Socket.IO engine'e ekle.
  // Bu sayede her socket bağlantısında socket.request.session üzerinden
  // oturum bilgilerine (userId dahil) erişilebilir.
  io.engine.use(sessionMiddleware);

  io.on("connection", (socket) => {
    const session = (socket.request as any).session;
    const authenticatedUserId: string | undefined = session?.userId;

    // Oturumu doğrulanmış kullanıcıyı bağlantı kurulur kurulmaz odasına al.
    // Böylece istemcinin joinUserRoom olayının ağda gecikmesi/kaçması bildirimleri geciktirmez.
    if (authenticatedUserId) {
      socket.join(`user_${authenticatedUserId}`);
    }

    // Kullanıcı kendi bildirim odasına katılmak istediğinde session doğrulaması yap.
    // session.userId ile istemciden gelen userId eşleşmiyorsa bağlantıyı kes.
    socket.on("joinUserRoom", (userId: string) => {
      if (!authenticatedUserId || authenticatedUserId !== userId) {
        // Kimlik doğrulama başarısız: yetkisiz oda katılımını reddet
        socket.disconnect(true);
        return;
      }

      socket.join(`user_${userId}`);
    });

    socket.on("disconnect", () => {
      // Clean up if necessary
    });
  });

  return io;
}

export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error("Socket.io has not been initialized yet!");
  }
  return io;
}
