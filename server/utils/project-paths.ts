import fs from "fs";
import path from "path";

function isProjectRoot(candidate: string): boolean {
  return fs.existsSync(path.join(candidate, "server", "package.json"))
    && fs.existsSync(path.join(candidate, "client", "package.json"));
}

export function getProjectRoot(): string {
  const entryDirectory = process.argv[1]
    ? path.dirname(path.resolve(process.argv[1]))
    : process.cwd();

  const candidates = [
    path.resolve(process.cwd()),
    path.resolve(process.cwd(), ".."),
    path.resolve(entryDirectory, ".."),
  ];

  return candidates.find(isProjectRoot) || path.resolve(process.cwd());
}
