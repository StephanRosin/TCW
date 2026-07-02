/**
 * Gemeinsame Fastify-/Pino-Logger-Konfiguration für alle TCW-Server.
 *
 * Redigiert personenbezogene bzw. sensible Felder aus den Request-Logs
 * (Client-IP, Authorization-/Cookie-Header), damit die Logfiles keine
 * unnötigen PII ansammeln (Log-Hygiene / DSGVO). Die Anwendung loggt sonst
 * keine Nutzdaten; dies ist eine reine Vorsichtsmassnahme gegen die
 * Pino-Default-Serializer.
 */
export interface ServerLoggerOptions {
  redact: {
    paths: string[];
    remove: boolean;
  };
}

export const SERVER_LOGGER_OPTIONS: ServerLoggerOptions = {
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "req.remoteAddress",
      "req.remotePort",
    ],
    remove: true,
  },
};
