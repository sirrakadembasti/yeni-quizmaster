import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { getProjectRoot } from "./utils/project-paths";

export function serveStatic(app: Express, basePath = "/") {
  const distPath = path.resolve(getProjectRoot(), "client/dist");
  
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  const mountPath = basePath === "/" ? "/" : basePath;
  app.use(mountPath, express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.get(basePath === "/" ? "*" : `${basePath}/*`, (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
