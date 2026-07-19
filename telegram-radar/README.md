# Radar de pistas para Telegram

Modulo independiente para Freedom Wellness XX Padel Club. Consulta una fuente autorizada de disponibilidad de Playtomic, evita avisos duplicados y prepara un mensaje para Telegram con boton de reserva.

## Estado inicial

La automatizacion esta deliberadamente en modo seguro:

- solo se puede ejecutar manualmente desde GitHub Actions
- `DRY_RUN` esta activado
- no envia mensajes mientras no se valide la respuesta real de Playtomic
- ningun token o password se guarda en el repositorio

## Secrets necesarios

En `Settings > Secrets and variables > Actions`:

- `PLAYTOMIC_TOKEN_URL`
- `PLAYTOMIC_AVAILABILITY_URL`
- `PLAYTOMIC_CLIENT_ID`
- `PLAYTOMIC_CLIENT_SECRET`
- `PLAYTOMIC_TENANT_ID` si la integracion lo necesita
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

Los datos de Playtomic deben proceder de una integracion/API autorizada del club. No se deben pegar credenciales personales en el codigo.

## Activacion posterior a la prueba

Cuando una ejecucion manual muestre los horarios correctos:

1. cambiar `DRY_RUN` a `false`
2. anadir el horario programado a `.github/workflows/telegram-availability.yml`
3. ejecutar una prueba de envio al grupo
4. comprobar el boton de reserva y la deduplicacion

La programacion recomendada es una consulta cada 30 minutos, con filtros adicionales para limitar los avisos generales a las 09:00, 14:00 y 18:00.
