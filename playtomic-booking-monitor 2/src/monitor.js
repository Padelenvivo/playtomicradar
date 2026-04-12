const { loadProcessedIds, saveProcessedIds } = require("./storage");
const {
  formatBookingMessage,
  formatBookingSubject,
  getBookingId
} = require("./bookingFormatter");

function createBookingMonitor({ config, playtomicClient, mailer, logger = console }) {
  let isPolling = false;
  let intervalHandle = null;

  async function checkForNewBookings() {
    if (isPolling) {
      logger.warn(`[${new Date().toISOString()}] Se omite esta ejecucion porque la anterior sigue activa.`);
      return;
    }

    isPolling = true;

    try {
      const processedIds = await loadProcessedIds(config.processedBookingsFile);
      const bookings = await playtomicClient.getBookings();
      const newBookings = [];

      for (const booking of bookings) {
        const bookingId = getBookingId(booking);

        if (!bookingId) {
          logger.warn(`[${new Date().toISOString()}] Se ha ignorado una reserva sin ID.`);
          continue;
        }

        if (processedIds.has(bookingId)) {
          continue;
        }

        newBookings.push(booking);
      }

      if (newBookings.length === 0) {
        logger.log(`[${new Date().toISOString()}] No se han detectado reservas nuevas.`);
        return;
      }

      for (const booking of newBookings) {
        const bookingId = getBookingId(booking);
        const subject = formatBookingSubject(booking, {
          clubName: config.clubName
        });
        const text = formatBookingMessage(booking, {
          clubName: config.clubName,
          timezone: config.timezone
        });

        await mailer.sendBookingAlert({ subject, text });

        processedIds.add(bookingId);
        await saveProcessedIds(config.processedBookingsFile, processedIds);

        logger.log(`[${new Date().toISOString()}] Alerta enviada para la reserva ${bookingId}.`);
      }
    } catch (error) {
      logger.error(`[${new Date().toISOString()}] Error monitorizando las reservas: ${error.message}`);
    } finally {
      isPolling = false;
    }
  }

  async function runOnce() {
    await checkForNewBookings();
  }

  async function start() {
    logger.log(
      `[${new Date().toISOString()}] ${config.appName} iniciado para ${config.clubName}. Se consultaran reservas cada ${
        config.pollIntervalMs / 1000
      } segundos.`
    );

    await runOnce();

    intervalHandle = setInterval(() => {
      void runOnce();
    }, config.pollIntervalMs);
  }

  function stop() {
    if (intervalHandle) {
      clearInterval(intervalHandle);
      intervalHandle = null;
    }
  }

  return {
    runOnce,
    start,
    stop
  };
}

module.exports = {
  createBookingMonitor
};
