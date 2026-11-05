import { z } from "zod";
import path from "path";
import { getProjectRoot } from "./project-paths";

export const uploadsDirectory = path.join(getProjectRoot(), "server", "uploads");

// Accept upload API paths as well as existing absolute image URLs.
export const questionImageUrlSchema = z.union([
  z.string().url(),
  z.string().regex(/^\/uploads\/[A-Za-z0-9_-][A-Za-z0-9._-]*$/),
]);
