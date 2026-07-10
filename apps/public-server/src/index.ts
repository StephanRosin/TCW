import { loadConfig } from "@tcw/core";
import { buildPublicApp } from "./app.js";

const config = loadConfig();

try {
  const app = await buildPublicApp(config);
  const address = await app.listen({ host: config.publicHost, port: config.publicPort });
  app.log.info(`TCW Public-Server läuft auf ${address}`);
} catch (error) {
  console.error(error);
  process.exit(1);
}
