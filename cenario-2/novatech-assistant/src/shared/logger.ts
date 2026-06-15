import pino from "pino";

export const logger = pino({
  base: {
    service: "novatech-assistant",
  },
  level: "info",
  timestamp: pino.stdTimeFunctions.isoTime,
});