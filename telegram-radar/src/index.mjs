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
  availabilityUrl: process.env.PLAYTOMIC_AVAILABILITY_URL || "https://api.playtomic.io/v1/availability",
  tenantId: process.env.PLAYTOMIC_TENANT_ID || "838146b1-c519-4000-82fa-017fc76304f5",
  telegramToken: process.env.TELEGRAM_BOT_TOKEN || "",
  telegramChatId: process.env.TELEGRAM_CHAT_ID || "",
  dryRun: (process.env.DRY_RUN ?? "true").toLowerCase() !== "false"
};

async function fetchJson(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(20000) });
  const body = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${body.slice(0, 300)}`);
  return body ? JSON.parse(body) : {};
}

async function getAvailability() {
  const url = new URL(config.availabilityUrl);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 2);
  url.searchParams.set("tenant_id", config.tenantId);
  url.searchParams.set("sport_id", "PADEL");
  url.searchParams.set("start_min", start.toISOString());
  url.searchParams.set("start_max", end.toISOString());
  const payload = await fetchJson(url, {
    headers: {
      accept: "application/json",
      origin: "https://playtomic.com",
      referer: config.bookingUrl
    }
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
    court: slot.court?.name || slot.court_name || slot.resource?.name || parent.court?.name || parent.name || COURTS[slot.resource_id || parent.resource_id] || "Pista disponible"
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
  if (!config.telegramToken || !config.telegramChatId) {
    throw new Error("Faltan TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID para enviar");
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

const COURTS = {
  "21b33866-d286-4f39-9fb6-2ee5f0f80cb1": "Padel 1 (Disponible Camara)",
  "e0bad04b-973b-4441-a31f-b6b1b357fd45": "Padel 2",
  "4c9c2e78-453e-453c-bb85-ace5cac9b573": "Padel 3",
  "de18245e-dfcb-41e7-9417-27aaa6b3b140": "Padel 4",
  "01146ba2-733a-4ec4-b96d-18c3620774c0": "Padel 5",
  "ba512821-d260-42df-b5fc-883e6ba36cf4": "Padel 6",
  "a7df009f-21d6-40e2-b0fc-8b1d5ade4eff": "Padel 7 (individual)",
  "67002651-fbec-4d17-893e-9b224598214e": "Padel 8",
  "3c4f04d4-77ef-47f9-a2fc-6bc799673fdf": "Padel 9",
  "26c02726-8f74-4483-9cbc-502f6d2b689d": "Padel 10",
  "483fd762-dcdc-4a69-958b-047879163d1e": "Padel 11",
  "1bfd6773-f030-4e9e-b83a-c27117d00b93": "Padel 12 (individual)",
  "99a52f1c-52ea-4584-9fba-7ef3fe68a439": "Padel 13",
  "6bd60081-1691-44e3-b475-a84b8506dddb": "Padel 14"
};

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
