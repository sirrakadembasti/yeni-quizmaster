import { createHash } from "node:crypto";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./api-routes/routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import session from "express-session";
import { createSessionStore } from "./utils/session-store";
import cors from "cors";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import path from "path";
import fs from "fs";
import { getProjectRoot } from "./utils/project-paths";
import * as dotenv from "dotenv";
import pinoHttp from "pino-http";
import { setupSocket } from "./socket";
import { generateToken, csrfSynchronisedProtection } from "./middleware/csrf";
import { secureJsonReplacer } from "./utils/json-security";
import { logger } from "./utils/logger";
import { setupDnsFallback } from "./utils/dns-fallback";
import { startEmailWorker } from "./utils/email";
import { uploadsDirectory } from "./utils/upload-paths";
import { getEffectiveDeploymentConfig } from "./utils/deployment-config";
import { startDataRetentionWorker } from "./services/data-retention";

// DNS Fallback: Windows/MEB ağında getaddrinfo ENOTFOUND hatalarını önler
setupDnsFallback();

const projectRoot = getProjectRoot();
const serverDirectory = path.join(projectRoot, "server");

// Çevresel değişkenleri yükle
dotenv.config({ path: path.resolve(serverDirectory, ".env") });
dotenv.config({ path: path.resolve(projectRoot, ".env") });

const deploymentConfig = getEffectiveDeploymentConfig();

export { logger };

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

const app = express();
const httpServer = createServer(app);

// Prevent nested Prisma relations from serializing credentials or recovery
// secrets if a route accidentally includes a complete User record.
app.set("json replacer", secureJsonReplacer);

// Security Headers
app.use(helmet({
  crossOriginResourcePolicy: false, // Allows cross-origin requests for resources (like images)
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  keyGenerator: (req) => req.session?.userId || req.ip || "unknown",
  max: 1000, // authenticated user; IP fallback before login
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later." },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  keyGenerator: (req) => (req.ip || "unknown") + ":" + createHash("sha256").update(String(req.body?.email || req.body?.token || "").trim().toLowerCase()).digest("hex"),
  max: 20, // per IP and login/reset identifier
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts, please try again later." },
});




app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(["/api/auth/login", "/api/auth/register", "/api/auth/forgot-password", "/api/auth/reset-password"], authLimiter);

// CORS configuration
const allowedOrigins = deploymentConfig.allowedOrigins;
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
}));

// Session configuration
// sessionMiddleware değişken olarak tanımlanıyor — Socket.IO ile paylaşmak için gerekli (bkz. socket.ts)
app.set("trust proxy", deploymentConfig.trustProxyHops);

// HTTP (pnpm dev / localhost) üzerinde Secure çerez yazılmaz → CSRF/login kırılır.
// Yalnızca gerçek HTTPS üretiminde secure + sameSite=none kullan.
const frontendUrl = process.env.FRONTEND_URL || deploymentConfig.publicUrl || "";
const isHttpsDeploy =
  process.env.NODE_ENV === "production" &&
  (String(frontendUrl).startsWith("https://") || process.env.FORCE_SECURE_COOKIES === "1");

const sessionDirectory = path.join(serverDirectory, "data");
fs.mkdirSync(sessionDirectory, { recursive: true });
const sessionMiddleware = session({
  store: createSessionStore(sessionDirectory),
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  name: "quizmaster.sid", // Custom cookie name for better security
  cookie: {
    secure: isHttpsDeploy,
    sameSite: isHttpsDeploy ? "none" : "lax",
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
});
app.use(sessionMiddleware);
app.use("/api/", limiter);

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDirectory)) {
  fs.mkdirSync(uploadsDirectory, { recursive: true });
}

// Serve uploads as static
app.use("/uploads", express.static(uploadsDirectory));

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
    
    // Protect every state-changing request, including auth and PATCH routes.
    app.use((req, res, next) => {
      if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method.toUpperCase())) {
        return csrfSynchronisedProtection(req, res, next);
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
      serveStatic(app, deploymentConfig.basePath);
    }

    const port = parseInt(process.env.PORT || "5000", 10);
    const host = process.env.HOST || "0.0.0.0";
    httpServer.listen(
      {
        port,
        host,
      },
      () => {
        logger.info({ host, port, basePath: deploymentConfig.basePath }, "Server serving");
        startEmailWorker();
        startDataRetentionWorker();
      },
    );
  } catch (error) {
    logger.fatal({ err: error }, "FATAL ERROR DURING STARTUP");
    process.exit(1);
  }
})();
