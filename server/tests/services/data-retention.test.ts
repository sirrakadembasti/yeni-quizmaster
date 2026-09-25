import { describe, expect, it } from "vitest";
import { retentionCutoffs } from "../../services/data-retention";

describe("retentionCutoffs", () => {
  it("her kayıt türü için yapılandırılmış gün kadar geriye gider", () => {
    const now = new Date("2026-09-24T12:00:00.000Z");
    const cutoffs = retentionCutoffs({
      enabled: true,
      actionLogDays: 365,
      readNotificationDays: 180,
      emailLogDays: 90,
      passwordResetDays: 30,
    }, now);

    expect(cutoffs.actionLogsBefore.toISOString()).toBe("2025-09-24T12:00:00.000Z");
    expect(cutoffs.readNotificationsBefore.toISOString()).toBe("2026-03-28T12:00:00.000Z");
    expect(cutoffs.emailLogsBefore.toISOString()).toBe("2026-06-26T12:00:00.000Z");
    expect(cutoffs.passwordResetsBefore.toISOString()).toBe("2026-08-25T12:00:00.000Z");
  });
});
