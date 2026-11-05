import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { getProjectRoot } from "./utils/project-paths";
import { isDemoInstanceEnabled } from "./utils/demo-mode";

export function renderIndexHtmlForBasePath(rawHtml: string, basePath = "/", demoMode = false): string {
  const normalizedBase = basePath === "/" ? "" : basePath.replace(/\/$/, "");
  const runtimeScript = `<script>window.__APP_BASE_PATH__=${JSON.stringify(normalizedBase)};window.__APP_DEMO_MODE__=${JSON.stringify(Boolean(demoMode))};</script>`;
  let html = rawHtml.includes("</head>")
    ? rawHtml.replace("</head>", `  ${runtimeScript}\n  </head>`)
    : `${runtimeScript}\n${rawHtml}`;

  if (normalizedBase) {
    html = html
      .replace(/(href|src)="\/assets\//g, `$1="${normalizedBase}/assets/`)
      .replace(/(href|src)='\/assets\//g, `$1='${normalizedBase}/assets/`);
  }
  return html;
}

export function serveStatic(app: Express, basePath = "/") {
  const distPath = path.resolve(getProjectRoot(), "client/dist");
  
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  const mountPath = basePath === "/" ? "/" : basePath;
  app.use(mountPath, express.static(distPath, { index: false }));

  const indexPath = path.resolve(distPath, "index.html");
  const sendIndex = (_req: express.Request, res: express.Response) => {
    const demoMode = isDemoInstanceEnabled();
    if (basePath === "/" && !demoMode) {
      return res.sendFile(indexPath);
    }
    const rawHtml = fs.readFileSync(indexPath, "utf8");
    res.type("html").send(renderIndexHtmlForBasePath(rawHtml, basePath, demoMode));
  };

  if (basePath !== "/") {
    app.get(basePath, sendIndex);
  }
  // fall through to index.html if the file doesn't exist
  app.get(basePath === "/" ? "*" : `${basePath}/*`, sendIndex);
}
