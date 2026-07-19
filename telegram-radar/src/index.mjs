import crypto from "node:crypto";

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Falta la variable obligatoria ${name}`);
  return value;
};

const config = {
  clubName: process.env.CLUB_NAME || "Freedom Wellness XX Padel Club",
  timezone: process.env.TIMEZONE || "Europe/Madrid",
  bookingUrl: process.env.BOOKING_URL || "https://playtomic.com/clubs/freedom-wellness-xx-padel-club",
  tokenUrl: process.env.PLAYTOMIC_TOKEN_URL || "https://api.playtomic.io/oauth/token",
  availabilityUrl: required("PLAYTOMIC_AVAILABILITY_URL"),
  clientId: required("PLAYTOMIC_CLIENT_ID"),
  clientSecret: required("PLAYTOMIC_CLIENT_SECRET"),
  tenantId: process.env.PLAYTOMIC_TENANT_ID || "",
  telegramToken: required("TELEGRAM_BOT_TOKEN"),
  telegramChatId: required("TELEGRAM_CHAT_ID"),
  dryRun: (process.env.DRY_RUN ?? "true").toLowerCase() !== "false"
};

async function fetchJson(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(20000) });
  const body = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${body.slice(0, 300)}`);
  return body ? JSON.parse(body) : {};
}

async function getAccessToken() {
  const payload = await fetchJson(config.tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: config.clientId,
      client_secret: config.clientSecret
    })
  });
  if (!payload.access_token) throw new Error("Playtomic no devolvio access_token");
  return payload.access_token;
}

async function getAvailability() {
  const token = await getAccessToken();
  const url = new URL(config.availabilityUrl);
  if (config.tenantId && !url.searchParams.has("tenant_id")) {
    url.searchParams.set("tenant_id", config.tenantId);
  }
  const payload = await fetchJson(url, {
    headers: { authorization: `Bearer ${token}`, accept: "application/json" }
  });
  return normalizeSlots(payload).filter((slot) => new Date(slot.start).getTime() > Date.now());
}

function normalizeSlots(payload) {
  const candidates = Array.isArray(payload)
    ? payload
    : payload.slots || payload.availability || payload.data || payload.results || [];

  return candidates.flatMap((item) => {
    const nested = item.slots || item.times || item.availability;
    if (Array.isArray(nested)) {
      return nested.map((slot) => normalizeSlot(slot, item)).filter(Boolean);
    }
    const slot = normalizeSlot(item, {});
    return slot ? [slot] : [];
  }).sort((a, b) => new Date(a.start) - new Date(b.start));
}

function normalizeSlot(slot, parent) {
  if (slot.available === false || slot.status === "unavailable" || slot.booked === true) return null;
  const start = slot.start || slot.start_date || slot.starts_at || slot.startTime || slot.from;
  const end = slot.end || slot.end_date || slot.ends_at || slot.endTime || slot.to;
  if (!start || !end || Number.isNaN(new Date(start).getTime()) || Number.isNaN(new Date(end).getTime())) return null;
  return {
    start: new Date(start).toISOString(),
    end: new Date(end).toISOString(),
    court: slot.court?.name || slot.court_name || slot.resource?.name || parent.court?.name || parent.name || "Pista disponible"
  };
}

function dateParts(iso) {
  const formatter = new Intl.DateTimeFormat("es-ES", {
    timeZone: config.timezone,
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  return Object.fromEntries(formatter.formatToParts(new Date(iso)).map((part) => [part.type, part.value]));
}

function formatMessage(slots) {
  const grouped = new Map();
  for (const slot of slots) {
    const start = dateParts(slot.start);
    const end = dateParts(slot.end);
    const day = `${start.weekday} ${start.day}/${start.month}`;
    const line = `${start.hour}:${start.minute}–${end.hour}:${end.minute} · ${slot.court}`;
    if (!grouped.has(day)) grouped.set(day, []);
    grouped.get(day).push(line);
  }

  const lines = [`🎾 <b>PISTAS DISPONIBLES</b>`, `<b>${escapeHtml(config.clubName)}</b>`, ""];
  for (const [day, daySlots] of grouped) {
    lines.push(`📅 <b>${escapeHtml(day)}</b>`);
    lines.push(...daySlots.slice(0, 20).map((line) => `• ${escapeHtml(line)}`));
    lines.push("");
  }
  lines.push(`👉 <a href="${escapeHtml(config.bookingUrl)}">Reservar en Playtomic</a>`);
  lines.push("<i>Disponibilidad sujeta a cambios.</i>");
  return lines.join("\n");
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

async function getLastHash() {
  if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_REPOSITORY) return "";
  const response = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/actions/variables/LAST_AVAILABILITY_HASH`, {
    headers: { authorization: `Bearer ${process.env.GITHUB_TOKEN}`, accept: "application/vnd.github+json" }
  });
  if (response.status === 404) return "";
  if (!response.ok) throw new Error(`No se pudo leer el estado (${response.status})`);
  return (await response.json()).value || "";
}

async function saveHash(value) {
  if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_REPOSITORY) return;
  const base = `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/actions/variables`;
  const current = await getLastHash();
  const response = await fetch(current ? `${base}/LAST_AVAILABILITY_HASH` : base, {
    method: current ? "PATCH" : "POST",
    headers: { authorization: `Bearer ${process.env.GITHUB_TOKEN}`, accept: "application/vnd.github+json", "content-type": "application/json" },
    body: JSON.stringify(current ? { name: "LAST_AVAILABILITY_HASH", value } : { name: "LAST_AVAILABILITY_HASH", value })
  });
  if (!response.ok) throw new Error(`No se pudo guardar el estado (${response.status})`);
}

async function sendTelegram(text) {
  if (config.dryRun) {
    console.log("DRY_RUN activo. Mensaje preparado:\n\n" + text);
    return;
  }
  await fetchJson(`https://api.telegram.org/bot${config.telegramToken}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: config.telegramChatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: { inline_keyboard: [[{ text: "Reservar pista", url: config.bookingUrl }]] }
    })
  });
}

async function main() {
  const slots = await getAvailability();
  if (!slots.length) {
    console.log("No hay huecos publicables.");
    return;
  }
  const message = formatMessage(slots);
  const hash = crypto.createHash("sha256").update(message).digest("hex");
  const previousHash = await getLastHash();
  if (hash === previousHash) {
    console.log("Sin cambios relevantes; no se prepara un nuevo aviso.");
    return;
  }
  await sendTelegram(message);
  if (!config.dryRun) await saveHash(hash);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
