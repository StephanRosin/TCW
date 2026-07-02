import { loadConfig } from "@tcw/core";
import { buildWaidcupApp } from "./app.js";

const config = loadConfig();

buildWaidcupApp(config)
  .then((app) =>
    app.listen({ host: config.waidcupHost, port: config.waidcupPort }).then((address) => {
      app.log.info(`TCW Waidcup-Server läuft auf ${address}`);
    }),
  )
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
