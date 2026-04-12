require("dotenv").config();

const { loadConfig } = require("./config");
const { createPlaytomicClient } = require("./playtomic");
const { createMailer } = require("./mailer");
const { createBookingMonitor } = require("./monitor");

async function main() {
  const config = loadConfig();
  const cliArgs = new Set(process.argv.slice(2));
  const playtomicClient = createPlaytomicClient({
    clientId: config.playtomicClientId,
    clientSecret: config.playtomicClientSecret
  });
  const mailer = createMailer(config);
  const monitor = createBookingMonitor({
    config,
    playtomicClient,
    mailer
  });

  if (cliArgs.has("--verify-smtp")) {
    await mailer.verifyConnection();
    console.log(`[${new Date().toISOString()}] Conexion SMTP verificada correctamente.`);
    return;
  }

  if (cliArgs.has("--once")) {
    await monitor.runOnce();
    return;
  }

  registerShutdown(monitor);
  await monitor.start();
}

function registerShutdown(monitor) {
  const shutdown = (signal) => {
    monitor.stop();
    console.log(`[${new Date().toISOString()}] Aplicacion detenida por ${signal}.`);
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((error) => {
  console.error(`[${new Date().toISOString()}] Error fatal al iniciar la aplicacion: ${error.message}`);
  process.exitCode = 1;
});
