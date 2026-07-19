# Radar de pistas para Telegram

Modulo independiente para Freedom Wellness XX Padel Club. Consulta una fuente autorizada de disponibilidad de Playtomic, evita avisos duplicados y prepara un mensaje para Telegram con boton de reserva.

## Instalacion recomendada en el Mac del club

1. Descargar el repositorio y abrir la carpeta `telegram-radar`.
2. Hacer doble clic en `setup-mac.command`.
3. Pegar el token cuando lo solicite y enviar un mensaje en el grupo para que detecte su identificador.
4. Revisar la prueba, que no publica ningun mensaje.
5. Abrir `activar-mac.command` para iniciar la revision cada 30 minutos.

Para detenerlo, abrir `detener-mac.command`. El token queda solamente en `.env` dentro del Mac con permisos restringidos.

## Estado inicial

La automatizacion esta deliberadamente en modo seguro:

- solo se puede ejecutar manualmente desde GitHub Actions
- `DRY_RUN` esta activado
- no envia mensajes mientras no se valide la respuesta real de Playtomic
- ningun token o password se guarda en el repositorio

## Secrets necesarios

En `Settings > Secrets and variables > Actions`:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

La lectura usa la pagina publica de disponibilidad que Playtomic muestra para el club y no necesita la contrasena de Playtomic Manager. No se deben pegar credenciales personales en el codigo.

## Activacion posterior a la prueba

Cuando una ejecucion manual muestre los horarios correctos:

1. cambiar `DRY_RUN` a `false`
2. anadir el horario programado a `.github/workflows/telegram-availability.yml`
3. ejecutar una prueba de envio al grupo
4. comprobar el boton de reserva y la deduplicacion

La programacion recomendada es una consulta cada 30 minutos, con filtros adicionales para limitar los avisos generales a las 09:00, 14:00 y 18:00.
