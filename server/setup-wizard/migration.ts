// Yöneticiden bağımsız mantıksal komut; gerçek komutu scripts/package-manager.mjs üretir.
export type SetupOp = { type: "run"; workspace?: "server" | "client"; script: string; args?: string[] };
export type SetupCommand = (op: SetupOp, extraEnv: NodeJS.ProcessEnv) => Promise<string>;

export function deploySetupDatabase(databaseUrl: string, execute: SetupCommand) {
  return execute({ type: "run", workspace: "server", script: "db:deploy" }, {
    DATABASE_URL: databaseUrl,
    // Prisma 5 parses the engine's initial INFO line before the missing-DB
    // error. Inherited warn/error logging suppresses it and blocks creation.
    RUST_LOG: "info",
  });
}
