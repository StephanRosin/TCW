import { loadConfig } from "@tcw/core";
import { buildAdminApp } from "./app.js";

const config = loadConfig();

try {
  const app = await buildAdminApp(config);
  const address = await app.listen({ host: config.adminHost, port: config.adminPort });
  app.log.info(`TCW Admin-Server läuft auf ${address}`);
} catch (error) {
  console.error(error);
  process.exit(1);
}
