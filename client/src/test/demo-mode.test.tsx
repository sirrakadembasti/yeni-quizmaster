import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEMO_READ_ONLY_CODE,
  DEMO_READ_ONLY_MESSAGE,
  DEFAULT_DEMO_SHOWCASE_ACCOUNTS,
  getAppBasePath,
  isClientDemoMode,
  isDemoShowcaseUserEmail,
  withAppBasePath,
} from "@/lib/demo-mode";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

vi.mock("sonner", () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("Client Demo Mode Helpers & Read-Only Toast", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete window.__APP_BASE_PATH__;
    delete window.__APP_DEMO_MODE__;
  });

  it("prefixes /api and /uploads with /demo when __APP_BASE_PATH__ is /demo", () => {
    expect(getAppBasePath()).toBe("");
    expect(withAppBasePath("/api/quizzes")).toBe("/api/quizzes");

    window.__APP_BASE_PATH__ = "/demo";
    window.__APP_DEMO_MODE__ = true;

    expect(getAppBasePath()).toBe("/demo");
    expect(isClientDemoMode()).toBe(true);
    expect(withAppBasePath("/api/quizzes")).toBe("/demo/api/quizzes");
    expect(withAppBasePath("/uploads/q1.png")).toBe("/demo/uploads/q1.png");
    expect(withAppBasePath("/demo/api/quizzes")).toBe("/demo/api/quizzes");
  });

  it("identifies the 4 showcase emails accurately", () => {
    expect(DEFAULT_DEMO_SHOWCASE_ACCOUNTS).toHaveLength(4);
    expect(isDemoShowcaseUserEmail("demo-admin@quizmaster.com")).toBe(true);
    expect(isDemoShowcaseUserEmail("demo-ogretmen@quizmaster.com")).toBe(true);
    expect(isDemoShowcaseUserEmail("demo-ogrenci@quizmaster.com")).toBe(true);
    expect(isDemoShowcaseUserEmail("demo-veli@quizmaster.com")).toBe(true);
    expect(isDemoShowcaseUserEmail("normal@quizmaster.com")).toBe(false);
  });

  it("displays an informational toast when apiFetch receives 403 DEMO_MODE_READ_ONLY", async () => {
    const fetchSpy = vi.spyOn(window, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith("/csrf-token")) {
        return new Response(JSON.stringify({ csrfToken: "test-csrf" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({
          code: DEMO_READ_ONLY_CODE,
          message: DEMO_READ_ONLY_MESSAGE,
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        },
      );
    });

    const response = await apiFetch("/api/quizzes", { method: "POST" });
    expect(response.status).toBe(403);
    expect(toast.info).toHaveBeenCalledWith("Demo Modu (Salt Okunur)", {
      description: DEMO_READ_ONLY_MESSAGE,
    });

    fetchSpy.mockRestore();
  });
});
