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
  const dates = madridDates(2);
  const all = [];
  for (const date of dates) {
    const url = new URL(config.bookingUrl);
    url.searchParams.set("date", date);
    const response = await fetch(url, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "Mozilla/5.0 (compatible; FreedomAvailabilityRadar/1.0)"
      },
      signal: AbortSignal.timeout(30000)
    });
    if (!response.ok) throw new Error(`No se pudo leer la pagina publica (${response.status})`);
    all.push(...parsePublicSlots(await response.text(), date));
  }
  return [...new Map(all.map((slot) => [slot.id, slot])).values()]
    .filter(isFutureLocalSlot)
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
}

function madridDates(count) {
  const formatter = new Intl.DateTimeFormat("es-ES", {
    timeZone: config.timezone,
    year: "numeric", month: "2-digit", day: "2-digit"
  });
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.now() + index * 86400000);
    const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  });
}

function parsePublicSlots(html, date) {
  const regex = /data-tracking-property-time="([^"]+)"\s+data-tracking-property-duration="(\d+)"[^>]*data-slot-id="([^"]+)"/g;
  return [...html.matchAll(regex)].map((match) => {
    const [, time, duration, id] = match;
    const resourceId = id.slice(0, 36);
    return { id: `${date}-${resourceId}-${time}-${duration}`, date, time: time.padStart(5, "0"), duration: Number(duration), court: COURTS[resourceId] || "Pista disponible" };
  });
}

function isFutureLocalSlot(slot) {
  const [today] = madridDates(1);
  if (slot.date !== today) return true;
  const nowTime = new Intl.DateTimeFormat("en-GB", { timeZone: config.timezone, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
  return slot.time > nowTime;
}

function formatMessage(slots) {
  const grouped = new Map();
  for (const slot of slots) {
    if (!grouped.has(slot.date)) grouped.set(slot.date, new Map());
    const key = `${slot.time}|${slot.duration}`;
    const day = grouped.get(slot.date);
    if (!day.has(key)) day.set(key, new Set());
    day.get(key).add(slot.court);
  }

  const lines = [`🎾 <b>PISTAS DISPONIBLES</b>`, `<b>${escapeHtml(config.clubName)}</b>`, ""];
  for (const [date, daySlots] of grouped) {
    lines.push(`📅 <b>${escapeHtml(formatDay(date))}</b>`);
    const entries = [...daySlots.entries()].slice(0, 24);
    for (const [key, courts] of entries) {
      const [time, duration] = key.split("|");
      lines.push(`• ${escapeHtml(time)} · ${courts.size} pista${courts.size === 1 ? "" : "s"} · ${duration} min`);
    }
    lines.push("");
  }
  lines.push(`👉 <a href="${escapeHtml(config.bookingUrl)}">Reservar en Playtomic</a>`);
  lines.push("<i>Disponibilidad sujeta a cambios.</i>");
  return lines.join("\n");
}

function formatDay(date) {
  return new Intl.DateTimeFormat("es-ES", { timeZone: "UTC", weekday: "long", day: "2-digit", month: "2-digit" }).format(new Date(`${date}T12:00:00Z`));
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
