import { describe, expect, it } from "vitest";
import { secureJsonReplacer } from "../../utils/json-security";

describe("secureJsonReplacer", () => {
  it("removes credentials and recovery secrets from nested JSON", () => {
    const payload = {
      user: {
        id: "user-1",
        email: "student@example.com",
        password: "hash",
        resetToken: "reset-secret",
        resetTokenExpiry: new Date("2030-01-01T00:00:00.000Z"),
        emailVerificationToken: "verify-secret",
      },
      csrfToken: "public-response-token",
    };

    const serialized = JSON.stringify(payload, secureJsonReplacer);
    const parsed = JSON.parse(serialized);

    expect(parsed).toEqual({
      user: {
        id: "user-1",
        email: "student@example.com",
      },
      csrfToken: "public-response-token",
    });
  });
});
