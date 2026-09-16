import pino from "pino";
import pretty from "pino-pretty";

const isProduction = process.env.NODE_ENV === "production";
const developmentLogStream = isProduction
  ? undefined
  : pretty({
      colorize: true,
      translateTime: "SYS:standard",
      ignore: "pid,hostname",
      sync: true,
    });

export const logger = pino(
  { level: isProduction ? "info" : "debug" },
  developmentLogStream,
);
