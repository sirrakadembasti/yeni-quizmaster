import path from "path";
import { getProjectRoot } from "./project-paths";

export const uploadsDirectory = path.join(getProjectRoot(), "server", "uploads");
