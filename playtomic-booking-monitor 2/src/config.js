const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const DEFAULT_POLL_INTERVAL_MS = 60_000;
const MIN_POLL_INTERVAL_MS = 60_000;

function getRequiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Falta la variable de entorno obligatoria: ${name}`);
  }

  return value;
}

function getOptionalEnv(name, fallbackValue) {
  const value = process.env[name];

  if (value === undefined || value === null || value === "") {
    return fallbackValue;
  }

  return value;
}

function parseIntegerEnv(name, fallbackValue) {
  const rawValue = getOptionalEnv(name, String(fallbackValue));
  const parsedValue = Number.parseInt(rawValue, 10);

  if (Number.isNaN(parsedValue)) {
    throw new Error(`${name} debe ser un numero entero valido.`);
  }

  return parsedValue;
}

function parseEmailList(value) {
  const emails = value
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);

  if (emails.length === 0) {
    throw new Error("ALERT_EMAIL_TO debe contener al menos una direccion de correo.");
  }

  return emails;
}

function loadConfig() {
  const smtpPort = parseIntegerEnv("SMTP_PORT", 587);
  const pollIntervalMs = parseIntegerEnv("POLL_INTERVAL_MS", DEFAULT_POLL_INTERVAL_MS);

  if (pollIntervalMs < MIN_POLL_INTERVAL_MS) {
    throw new Error(`POLL_INTERVAL_MS no puede ser inferior a ${MIN_POLL_INTERVAL_MS}.`);
  }

  return {
    appName: getOptionalEnv("APP_NAME", "Playtomic Booking Monitor"),
    clubName: getOptionalEnv("CLUB_NAME", "Club sin nombre"),
    playtomicClientId: getRequiredEnv("PLAYTOMIC_CLIENT_ID"),
    playtomicClientSecret: getRequiredEnv("PLAYTOMIC_CLIENT_SECRET"),
    smtpHost: getRequiredEnv("SMTP_HOST"),
    smtpPort,
    smtpUser: getRequiredEnv("SMTP_USER"),
    smtpPass: getRequiredEnv("SMTP_PASS"),
    fromEmail: getRequiredEnv("FROM_EMAIL"),
    alertEmailTo: parseEmailList(getRequiredEnv("ALERT_EMAIL_TO")),
    processedBookingsFile:
      getOptionalEnv("PROCESSED_BOOKINGS_FILE", "") ||
      path.join(PROJECT_ROOT, "data", "processed-bookings.json"),
    pollIntervalMs,
    timezone: getOptionalEnv("TIMEZONE", "Europe/Madrid")
  };
}

module.exports = {
  loadConfig
};
