import { describe, expect, it } from "vitest";
import { z } from "zod";
import { onlySentKeys } from "../../utils/patch-body";

const schema = z.object({
  title: z.string().min(3),
  status: z.enum(["draft", "published"]).default("draft"),
  classIds: z.array(z.string()).optional().default([]),
});

describe("onlySentKeys", () => {
  it("Zod 4 partial() gönderilmeyen alanlara varsayılan uygular; filtre bunları temizler", () => {
    const body = { title: "Yeni başlık" };
    const parsed = schema.partial().parse(body);
    expect(parsed.status).toBe("draft"); // tuzak: gönderilmedi ama dolu geliyor
    expect(onlySentKeys(parsed, body)).toEqual({ title: "Yeni başlık" });
  });

  it("gönderilen alanları değerleriyle korur", () => {
    const body = { status: "published", classIds: [] };
    expect(onlySentKeys(schema.partial().parse(body), body)).toEqual({ status: "published", classIds: [] });
  });

  it("nesne olmayan gövdede boş döner", () => {
    expect(onlySentKeys({ a: 1 }, null)).toEqual({});
  });
});
