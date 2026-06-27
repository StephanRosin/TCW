import { loadConfig } from "@tcw/core";
import { buildAdminApp } from "./app.js";

const config = loadConfig();

buildAdminApp(config)
  .then((app) =>
    app.listen({ host: config.adminHost, port: config.adminPort }).then((address) => {
      app.log.info(`TCW Admin-Server läuft auf ${address}`);
    }),
  )
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
