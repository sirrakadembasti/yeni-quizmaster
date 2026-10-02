export type SetupCommand = (args: string[], extraEnv: NodeJS.ProcessEnv) => Promise<string>;

export function deploySetupDatabase(databaseUrl: string, execute: SetupCommand) {
  return execute(["--filter", "quiz-master-server", "db:deploy"], {
    DATABASE_URL: databaseUrl,
    // Prisma 5 parses the engine's initial INFO line before the missing-DB
    // error. Inherited warn/error logging suppresses it and blocks creation.
    RUST_LOG: "info",
  });
}
