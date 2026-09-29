import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import fs from "fs";
import path from "path";
import sharp from "sharp";

vi.mock("../../middleware/auth", () => ({
  requireAuth: (_req: any, _res: any, next: any) => next(),
  requireRole: () => (_req: any, _res: any, next: any) => next(),
}));

import uploadRouter from "../../api-routes/upload";
import { uploadsDirectory } from "../../utils/upload-paths";

describe("Question image upload API", () => {
  const createdFiles: string[] = [];

  afterEach(async () => {
    for (const file of createdFiles.splice(0)) {
      if (fs.existsSync(file)) await fs.promises.rm(file, { maxRetries: 5, retryDelay: 100 });
    }
  });

  it("accepts PNG and stores an optimized WEBP in the served upload directory", async () => {
    const png = await sharp({ create: { width: 8, height: 8, channels: 4, background: "#4f46e5" } }).png().toBuffer();
    const app = express();
    app.use("/api/upload", uploadRouter);

    const response = await request(app).post("/api/upload").attach("image", png, { filename: "soru.png", contentType: "image/png" });

    expect(response.status).toBe(200);
    expect(response.body.imageUrl).toMatch(/^\/uploads\/[a-f0-9-]+\.webp$/);
    const storedPath = path.join(uploadsDirectory, path.basename(response.body.imageUrl));
    createdFiles.push(storedPath);
    expect(fs.existsSync(storedPath)).toBe(true);
    const signature = await fs.promises.readFile(storedPath);
    expect(signature.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(signature.subarray(8, 12).toString("ascii")).toBe("WEBP");
  });

  it("rejects unsupported files", async () => {
    const app = express();
    app.use("/api/upload", uploadRouter);
    const response = await request(app).post("/api/upload").attach("image", Buffer.from("not-an-image"), { filename: "soru.txt", contentType: "text/plain" });
    expect(response.status).toBe(400);
  });
});
