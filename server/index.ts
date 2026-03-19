import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./api-routes/routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import session from "express-session";
import connectSqlite3 from "connect-sqlite3";
import cors from "cors";
import rateLimit from "express-rate-limit";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SQLiteStore = connectSqlite3(session);

const app = express();
const httpServer = createServer(app);

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
app.use(session({
  store: new SQLiteStore({
    db: "sessions.db",
    dir: "./",
  }) as any,
  secret: process.env.SESSION_SECRET || "quiz-master-secret-key",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
}));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve uploads as static
app.use("/uploads", express.static(uploadsDir));

function log(message: string) {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [express] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: any = null;

  const originalResJson = res.json;
  res.json = function (body) {
    capturedJsonResponse = body;
    return originalResJson.apply(res, arguments as any);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    log("Starting server...");
    
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
      
      console.error("API Error:", {
        status,
        message,
        path: req.path,
        error: err.stack
      });

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
        log(`Server serving on port ${port}`);
      },
    );
  } catch (error) {
    console.error("FATAL ERROR DURING STARTUP:", error);
    process.exit(1);
  }
})();
