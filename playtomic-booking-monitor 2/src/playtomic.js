const TOKEN_URL = "https://api.playtomic.io/oauth/token";
const BOOKINGS_URL = "https://api.playtomic.io/v1/bookings";
const REQUEST_TIMEOUT_MS = 15_000;

function createPlaytomicClient({ clientId, clientSecret, fetchImpl = globalThis.fetch }) {
  if (typeof fetchImpl !== "function") {
    throw new Error("No se ha encontrado una implementacion de fetch en este entorno.");
  }

  let tokenCache = {
    accessToken: null,
    expiresAt: 0
  };

  async function requestAccessToken() {
    const response = await fetchImpl(TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "client_credentials"
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });

    if (!response.ok) {
      throw new Error(`No se pudo obtener el token de Playtomic (${response.status} ${response.statusText}).`);
    }

    const payload = await response.json();

    if (!payload.access_token) {
      throw new Error("La respuesta de Playtomic no incluye access_token.");
    }

    const expiresInSeconds = Number.parseInt(payload.expires_in, 10) || 3600;

    tokenCache = {
      accessToken: payload.access_token,
      expiresAt: Date.now() + expiresInSeconds * 1000
    };

    return tokenCache.accessToken;
  }

  async function getAccessToken(forceRefresh = false) {
    const shouldRefresh =
      forceRefresh ||
      !tokenCache.accessToken ||
      Date.now() >= tokenCache.expiresAt - 60_000;

    if (shouldRefresh) {
      return requestAccessToken();
    }

    return tokenCache.accessToken;
  }

  async function fetchBookingsResponse(accessToken) {
    return fetchImpl(BOOKINGS_URL, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json"
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
  }

  async function getBookings() {
    let accessToken = await getAccessToken();
    let response = await fetchBookingsResponse(accessToken);

    if (response.status === 401) {
      accessToken = await getAccessToken(true);
      response = await fetchBookingsResponse(accessToken);
    }

    if (!response.ok) {
      throw new Error(`No se pudieron obtener las reservas (${response.status} ${response.statusText}).`);
    }

    const payload = await response.json();

    return normalizeBookingsPayload(payload);
  }

  return {
    getBookings
  };
}

function normalizeBookingsPayload(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload.bookings)) {
    return payload.bookings;
  }

  if (Array.isArray(payload.data)) {
    return payload.data;
  }

  if (Array.isArray(payload.results)) {
    return payload.results;
  }

  throw new Error("La respuesta de reservas de Playtomic no tiene un formato reconocido.");
}

module.exports = {
  createPlaytomicClient
};
