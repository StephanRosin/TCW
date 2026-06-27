import { loadConfig } from "@tcw/core";
import { buildPublicApp } from "./app.js";

const config = loadConfig();

buildPublicApp(config)
  .then((app) =>
    app.listen({ host: config.publicHost, port: config.publicPort }).then((address) => {
      app.log.info(`TCW Public-Server läuft auf ${address}`);
    }),
  )
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
