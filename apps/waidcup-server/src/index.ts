import { loadConfig } from "@tcw/core";
import { buildWaidcupApp } from "./app.js";

const config = loadConfig();

try {
  const app = await buildWaidcupApp(config);
  const address = await app.listen({ host: config.waidcupHost, port: config.waidcupPort });
  app.log.info(`TCW Waidcup-Server läuft auf ${address}`);
} catch (error) {
  console.error(error);
  process.exit(1);
}
