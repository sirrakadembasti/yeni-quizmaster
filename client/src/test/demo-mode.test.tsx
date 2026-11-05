import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEMO_READ_ONLY_CODE,
  DEMO_READ_ONLY_MESSAGE,
  DEFAULT_DEMO_SHOWCASE_ACCOUNTS,
  enterDemoNamespace,
  exitDemoNamespace,
  getAccountDemoPassword,
  getAppBasePath,
  isBrowserOnDemoPath,
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
    window.history.pushState(null, "", "/");
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

  it("identifies the 4 showcase emails and preserves demoPassword", () => {
    expect(DEFAULT_DEMO_SHOWCASE_ACCOUNTS).toHaveLength(4);
    for (const acc of DEFAULT_DEMO_SHOWCASE_ACCOUNTS) {
      expect(getAccountDemoPassword(acc)).toBe("demo123456");
    }
    expect(isDemoShowcaseUserEmail("demo-admin@quizmaster.com")).toBe(true);
    expect(isDemoShowcaseUserEmail("demo-ogretmen@quizmaster.com")).toBe(true);
    expect(isDemoShowcaseUserEmail("demo-ogrenci@quizmaster.com")).toBe(true);
    expect(isDemoShowcaseUserEmail("demo-veli@quizmaster.com")).toBe(true);
    expect(isDemoShowcaseUserEmail("normal@quizmaster.com")).toBe(false);
  });

  it("maintains /demo prefix in browser location via enterDemoNamespace and exitDemoNamespace", () => {
    expect(isBrowserOnDemoPath()).toBe(false);
    expect(isClientDemoMode()).toBe(false);

    enterDemoNamespace("/results");
    expect(window.location.pathname).toBe("/demo/results");
    expect(isBrowserOnDemoPath()).toBe(true);
    expect(isClientDemoMode()).toBe(true);

    enterDemoNamespace("/");
    expect(window.location.pathname).toBe("/demo");
    expect(isBrowserOnDemoPath()).toBe(true);

    exitDemoNamespace();
    expect(window.location.pathname).toBe("/");
    expect(isBrowserOnDemoPath()).toBe(false);
  });

  it("displays an informational toast when apiFetch receives 403 DEMO_MODE_READ_ONLY and sends x-quizmaster-demo header on /demo", async () => {
    enterDemoNamespace("/results");
    let capturedDemoHeader: string | null = null;

    const fetchSpy = vi.spyOn(window, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      const headers = new Headers(init?.headers);
      if (url.endsWith("/api/quizzes")) {
        capturedDemoHeader = headers.get("x-quizmaster-demo");
      }
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
    expect(capturedDemoHeader).toBe("1");
    expect(toast.info).toHaveBeenCalledWith("Demo Modu (Salt Okunur)", {
      description: DEMO_READ_ONLY_MESSAGE,
    });

    fetchSpy.mockRestore();
  });
});
