const DEFAULT_TIMEZONE = "Europe/Madrid";
const DEFAULT_CURRENCY = "EUR";

function getBookingId(booking) {
  const rawId = firstDefined([
    booking?.id,
    booking?.booking_id,
    booking?.bookingId,
    booking?.uuid
  ]);

  if (rawId === null || rawId === undefined || rawId === "") {
    return null;
  }

  return String(rawId);
}

function formatBookingSubject(booking, options = {}) {
  const courtName = getCourtName(booking);
  const prefix = options.clubName
    ? `Nueva reserva en ${options.clubName}`
    : "Nueva reserva en Playtomic";

  return `${prefix}: ${courtName}`;
}

function formatBookingMessage(booking, options = {}) {
  const timezone = options.timezone || DEFAULT_TIMEZONE;
  const bookingId = getBookingId(booking) || "Desconocido";
  const courtName = getCourtName(booking);
  const bookingDate = formatMadridDate(getStartDateValue(booking), timezone);
  const playerCount = getPlayerCount(booking);
  const totalAmount = getFormattedTotalAmount(booking);
  const clubName = options.clubName || "Club sin nombre";

  return [
    "Se ha detectado una nueva reserva en Playtomic.",
    "",
    `Club: ${clubName}`,
    `ID de reserva: ${bookingId}`,
    `Pista: ${courtName}`,
    `Fecha y hora (${timezone}): ${bookingDate}`,
    `Numero de jugadores: ${playerCount}`,
    `Importe total: ${totalAmount}`
  ].join("\n");
}

function getCourtName(booking) {
  return (
    firstString([
      booking?.court?.name,
      booking?.court_name,
      booking?.courtName,
      booking?.resource?.name,
      booking?.resource_name,
      booking?.track?.name,
      booking?.field?.name,
      booking?.venue?.court_name
    ]) || "Pista desconocida"
  );
}

function getStartDateValue(booking) {
  return firstDefined([
    booking?.start_date,
    booking?.startDate,
    booking?.starts_at,
    booking?.startsAt,
    booking?.start_time,
    booking?.startTime,
    booking?.date
  ]);
}

function getPlayerCount(booking) {
  const directCount = firstDefined([
    booking?.players_count,
    booking?.playersCount,
    booking?.player_count,
    booking?.playerCount,
    booking?.participants_count,
    booking?.participantsCount
  ]);

  if (isNumericValue(directCount)) {
    return Number(directCount);
  }

  const players = firstDefined([
    booking?.players,
    booking?.player_list,
    booking?.playerList,
    booking?.participants
  ]);

  if (Array.isArray(players)) {
    return players.length;
  }

  return "No disponible";
}

function getFormattedTotalAmount(booking) {
  const topLevelAmountCandidates = [
    booking?.total_amount,
    booking?.totalAmount,
    booking?.total_price,
    booking?.totalPrice,
    booking?.price,
    booking?.amount
  ];

  for (const candidate of topLevelAmountCandidates) {
    if (isNumericValue(candidate)) {
      return formatCurrency(Number(candidate), getCurrencyCode(booking));
    }

    const parsedAmount = parseAmountCandidate(candidate, getCurrencyCode(booking));

    if (parsedAmount) {
      return parsedAmount;
    }
  }

  const paymentLikeValues = [
    booking?.payment,
    booking?.payment_info,
    booking?.paymentInfo,
    booking?.pricing,
    booking?.totals
  ];

  for (const candidate of paymentLikeValues) {
    const parsedAmount = parseAmountCandidate(candidate, getCurrencyCode(booking));

    if (parsedAmount) {
      return parsedAmount;
    }
  }

  return "Importe no disponible";
}

function parseAmountCandidate(candidate, fallbackCurrency) {
  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  const currency = firstString([
    candidate.currency,
    candidate.currency_code,
    candidate.currencyCode,
    fallbackCurrency
  ]) || DEFAULT_CURRENCY;

  const amountInMajorUnits = firstDefined([
    candidate.amount,
    candidate.total,
    candidate.value,
    candidate.price
  ]);

  if (Number.isFinite(Number(amountInMajorUnits))) {
    return formatCurrency(Number(amountInMajorUnits), currency);
  }

  const amountInMinorUnits = firstDefined([
    candidate.amount_cents,
    candidate.amountCents,
    candidate.total_cents,
    candidate.totalCents,
    candidate.cents
  ]);

  if (Number.isFinite(Number(amountInMinorUnits))) {
    return formatCurrency(Number(amountInMinorUnits) / 100, currency);
  }

  return null;
}

function getCurrencyCode(booking) {
  return (
    firstString([
      booking?.currency,
      booking?.currency_code,
      booking?.currencyCode,
      booking?.payment?.currency,
      booking?.payment?.currency_code,
      booking?.pricing?.currency
    ]) || DEFAULT_CURRENCY
  );
}

function formatMadridDate(value, timezone) {
  if (!value) {
    return "Fecha desconocida";
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Fecha desconocida";
  }

  return new Intl.DateTimeFormat("es-ES", {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function formatCurrency(amount, currency) {
  try {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency
    }).format(amount);
  } catch (error) {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function isNumericValue(value) {
  return value !== "" && value !== null && value !== undefined && Number.isFinite(Number(value));
}

function firstDefined(values) {
  return values.find((value) => value !== undefined && value !== null);
}

function firstString(values) {
  return values.find((value) => typeof value === "string" && value.trim() !== "");
}

module.exports = {
  formatBookingMessage,
  formatBookingSubject,
  getBookingId
};
