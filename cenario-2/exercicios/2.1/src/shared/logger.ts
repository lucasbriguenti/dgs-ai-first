import pino from "pino";

// Singleton logger shared across the app.
export const logger = pino({
    level: process.env.LOG_LEVEL ?? "info",
    base: {
        service: "novatech-assistant",
    },
});
