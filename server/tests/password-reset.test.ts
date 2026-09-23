import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import express from "express";
import session from "express-session";
import crypto from "crypto";
import bcrypt from "bcryptjs";

const mocks = vi.hoisted(() => ({
  getUserByEmail: vi.fn(),
  getUserByResetToken: vi.fn(),
  updateUser: vi.fn(),
  createLog: vi.fn(),
  sendResetPasswordEmail: vi.fn(),
}));

vi.mock("../storage", () => ({
  storage: {
    getUserByEmail: mocks.getUserByEmail,
    getUserByResetToken: mocks.getUserByResetToken,
    updateUser: mocks.updateUser,
    createLog: mocks.createLog,
  },
}));
vi.mock("../utils/email", () => ({ sendResetPasswordEmail: mocks.sendResetPasswordEmail }));

import authRouter from "../api-routes/auth";

const app = express();
app.use(express.json());
app.use(session({ secret: "password-reset-test", resave: false, saveUninitialized: false }));
app.use("/auth", authRouter);

describe("Password reset flow", () => {
  beforeEach(() => vi.clearAllMocks());

  it("stores only a token hash and queues the raw token for the email", async () => {
    mocks.getUserByEmail.mockResolvedValue({ id: "admin-1", email: "admin@example.com" });
    mocks.updateUser.mockResolvedValue({ id: "admin-1" });
    mocks.sendResetPasswordEmail.mockResolvedValue({ id: "mail-1" });

    const response = await request(app).post("/auth/forgot-password").send({ email: "admin@example.com" });

    expect(response.status).toBe(200);
    const update = mocks.updateUser.mock.calls[0][1];
    const rawToken = mocks.sendResetPasswordEmail.mock.calls[0][1];
    expect(update.resetToken).toBe(crypto.createHash("sha256").update(rawToken).digest("hex"));
    expect(update.resetToken).not.toBe(rawToken);
    expect(update.resetTokenExpiry.getTime()).toBeGreaterThan(Date.now());
  });

  it("does not reveal whether an email exists", async () => {
    mocks.getUserByEmail.mockResolvedValue(null);
    const response = await request(app).post("/auth/forgot-password").send({ email: "unknown@example.com" });
    expect(response.status).toBe(200);
    expect(mocks.sendResetPasswordEmail).not.toHaveBeenCalled();
  });

  it("accepts a valid token, hashes the password and invalidates the token", async () => {
    mocks.getUserByResetToken.mockResolvedValue({
      id: "admin-1",
      resetTokenExpiry: new Date(Date.now() + 60_000),
    });
    mocks.updateUser.mockResolvedValue({ id: "admin-1" });

    const response = await request(app).post("/auth/reset-password").send({
      token: "valid-raw-token",
      password: "NewSecurePassword123!",
    });

    expect(response.status).toBe(200);
    expect(mocks.getUserByResetToken).toHaveBeenCalledWith(
      crypto.createHash("sha256").update("valid-raw-token").digest("hex")
    );
    const update = mocks.updateUser.mock.calls[0][1];
    expect(await bcrypt.compare("NewSecurePassword123!", update.password)).toBe(true);
    expect(update.resetToken).toBeNull();
    expect(update.resetTokenExpiry).toBeNull();
  });
});