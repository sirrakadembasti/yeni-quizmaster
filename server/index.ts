import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./api-routes/routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import session from "express-session";
import connectSqlite3 from "connect-sqlite3";
import cors from "cors";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import * as dotenv from "dotenv";
import pino from "pino";
import pinoHttp from "pino-http";
import { setupSocket } from "./socket";
import { generateToken, csrfSynchronisedProtection } from "./middleware/csrf";

// Load environment variables
dotenv.config();

// Initialize pino logger
export const logger = pino({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  transport: process.env.NODE_ENV !== "production" ? {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "SYS:standard",
      ignore: "pid,hostname",
    },
  } : undefined,
});

const httpLogger = pinoHttp({
  logger,
  customLogLevel: function (req, res, err) {
    if (res.statusCode >= 400 && res.statusCode < 500) {
      return "warn";
    } else if (res.statusCode >= 500 || err) {
      return "error";
    } else if (res.statusCode >= 300 && res.statusCode < 400) {
      return "silent";
    }
    return "info";
  },
  autoLogging: {
    ignore: (req) => {
      if (req.url && (req.url.startsWith('/assets') || req.url.startsWith('/uploads'))) {
        return true;
      }
      return false;
    }
  }
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==================== SESSION_SECRET KONTROLÜ ====================
// SESSION_SECRET olmadan session güvenliği sağlanamaz. Güvensiz fallback engellendi.
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  logger.fatal(
    "SESSION_SECRET env değişkeni tanımlanmamış. " +
    "Güvenli bir session secret olmadan uygulama başlatılamaz. (Fail-fast koruması) " +
    ".env dosyanıza SESSION_SECRET=<güçlü-rastgele-değer> satırını ekleyin."
  );
  process.exit(1);
}

const SQLiteStore = connectSqlite3(session);

const app = express();
const httpServer = createServer(app);

// Security Headers
app.use(helmet({
  crossOriginResourcePolicy: false, // Allows cross-origin requests for resources (like images)
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later." },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 auth requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts, please try again later." },
});

app.use("/api/", limiter);
app.use("/api/auth/", authLimiter);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || ["http://localhost:5173", "http://127.0.0.1:5173"];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
}));

// Session configuration
// sessionMiddleware değişken olarak tanımlanıyor — Socket.IO ile paylaşmak için gerekli (bkz. socket.ts)
app.set("trust proxy", 1); // Trust first proxy (e.g. Nginx, Heroku)
const sessionMiddleware = session({
  store: new SQLiteStore({
    db: "sessions.db",
    dir: "./data",
  }) as any,
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  name: "quizmaster.sid", // Custom cookie name for better security
  cookie: {
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
});
app.use(sessionMiddleware);

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve uploads as static
app.use("/uploads", express.static(uploadsDir));

app.use(httpLogger);

(async () => {
  try {
    logger.info("Starting server...");

    // Initialize Socket.io — sessionMiddleware paylaşılıyor, oda auth için gerekli
    setupSocket(httpServer, sessionMiddleware);

    // CSRF Protection - CSRF token endpoint'i CSRF korumasından muaf olmalı
    app.get("/api/csrf-token", (req, res) => {
      res.json({ csrfToken: generateToken(req) });
    });
    
    // Apply CSRF protection to all POST/PUT/DELETE routes but exclude auth endpoints
    app.use((req, res, next) => {
      // CSRF protection'u sadece POST/PUT/DELETE isteklerine uygula
      // GET/HEAD/OPTIONS istekleri hariç tutma (token almak için)
      if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
        // Auth endpoints'e CSRF koruması uygulama (login, register, logout)
        if (!req.path.startsWith('/api/auth/')) {
          return csrfSynchronisedProtection(req, res, next);
        }
      }
      next();
    });

    // Initialize application routes
    await registerRoutes(httpServer, app);

    // API 404 Handler - If it starts with /api and reaches here, it's a 404
    app.use("/api/*", (req, res) => {
      res.status(404).json({ message: `API rotası bulunamadı: ${req.originalUrl}` });
    });

    // Global error handler for API
    app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Dahili Sunucu Hatası";

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
    });

    // In production, serve static files from the built client
    if (process.env.NODE_ENV === "production") {
      serveStatic(app);
    }

    const port = parseInt(process.env.PORT || "5000", 10);
    httpServer.listen(
      {
        port,
        host: "0.0.0.0", // Listen on all interfaces
      },
      () => {
        logger.info(`Server serving on port ${port}`);
      },
    );
  } catch (error) {
    logger.fatal({ err: error }, "FATAL ERROR DURING STARTUP");
    process.exit(1);
  }
})();
