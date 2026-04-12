# Playtomic Booking Monitor

App en Node.js para clubs que monitoriza nuevas reservas en Playtomic y envía alertas por correo electrónico. Está pensada para poder reutilizarse con distintos clubs sin cambiar el código: toda la personalización se hace mediante variables de entorno.

## Demo sin instalar nada

Si solo quieres ver el producto final de forma visual, abre uno de estos archivos:

- `ABRIR_DEMO.command`
- `demo.html`

La demo funciona en local, sin servidor y sin dependencias. Te deja:

- introducir el nombre del club
- simular una reserva nueva
- ver el email que se enviaría
- comprobar cómo se evita un duplicado

## Qué incluye

- Autenticación OAuth2 contra la API de Playtomic
- Consulta de reservas cada minuto, respetando el límite indicado
- Detección de reservas nuevas mediante persistencia local de IDs
- Email de alerta con pista, fecha, hora local, jugadores e importe
- Modo de prueba de ejecución única
- Modo de verificación SMTP
- Despliegue local, con Docker o como servicio Linux

## Arranque rápido en local

### 1. Requisitos

- Node.js 18 o superior
- `npm`
- Credenciales OAuth2 de Playtomic
- Un servidor SMTP válido

### 2. Instalación

```bash
cd /Users/juanantonioreylazaro/Documents/Playground/playtomic-booking-monitor
cp .env.example .env
npm install
```

### 3. Configura `.env`

```env
APP_NAME=Playtomic Booking Monitor
CLUB_NAME=Mi Club
PLAYTOMIC_CLIENT_ID=tu_client_id
PLAYTOMIC_CLIENT_SECRET=tu_client_secret
SMTP_HOST=smtp.tudominio.com
SMTP_PORT=587
SMTP_USER=tu_usuario_smtp
SMTP_PASS=tu_password_smtp
FROM_EMAIL=alertas@tuclub.com
ALERT_EMAIL_TO=destinatario@tuclub.com
TIMEZONE=Europe/Madrid
POLL_INTERVAL_MS=60000
```

### 4. Verifica SMTP

```bash
npm run verify:smtp
```

### 5. Lanza una prueba de lectura

Esto ejecuta una sola comprobación y termina:

```bash
npm run start:once
```

### 6. Arranca el monitor continuo

```bash
npm start
```

## Ponerlo online en Render

La forma más simple para esta app es usar un `Background Worker` de Render con disco persistente.

### Por qué esta opción

- esta app no necesita una web pública
- necesita estar siempre encendida
- necesita guardar un archivo con IDs procesados
- Render soporta `background workers` y `persistent disks`

### Lo que ya te he dejado preparado

- `render.yaml` para desplegarla en Render
- `Dockerfile` para construir la app
- `PROCESSED_BOOKINGS_FILE` listo para usar el disco persistente en `/app/data/processed-bookings.json`

### Pasos

1. Sube esta carpeta a un repositorio de GitHub.
2. Crea una cuenta en Render.
3. En Render, elige `New +` y luego `Blueprint`.
4. Conecta tu repositorio de GitHub.
5. Render leerá el archivo `render.yaml` automáticamente.
6. Cuando te pida variables secretas, rellena:
   - `CLUB_NAME`
   - `PLAYTOMIC_CLIENT_ID`
   - `PLAYTOMIC_CLIENT_SECRET`
   - `SMTP_HOST`
   - `SMTP_USER`
   - `SMTP_PASS`
   - `FROM_EMAIL`
   - `ALERT_EMAIL_TO`
7. Confirma el despliegue.
8. Cuando termine, entra en `Logs` y comprueba que el worker ha arrancado correctamente.

### Coste y detalles importantes

- Render permite `background workers` como un tipo de servicio específico.
- Los discos persistentes se pueden adjuntar a `background workers` de pago.
- En Render, el sistema de ficheros es efímero por defecto, así que el disco persistente es importante para no reenviar reservas ya procesadas.

### Enlaces oficiales

- Render Background Workers: https://render.com/docs/background-workers
- Render Persistent Disks: https://render.com/docs/disks
- Render Blueprint `render.yaml`: https://render.com/docs/blueprint-spec
- Render Pricing: https://render.com/pricing/

## Variables de entorno

### Obligatorias

- `PLAYTOMIC_CLIENT_ID`: client ID OAuth2 de Playtomic.
- `PLAYTOMIC_CLIENT_SECRET`: client secret OAuth2 de Playtomic.
- `SMTP_HOST`: host del servidor SMTP.
- `SMTP_PORT`: puerto del servidor SMTP.
- `SMTP_USER`: usuario SMTP.
- `SMTP_PASS`: contraseña SMTP.
- `FROM_EMAIL`: remitente del correo.
- `ALERT_EMAIL_TO`: destinatario o lista separada por comas.

### Opcionales

- `APP_NAME`: nombre comercial de la app.
- `CLUB_NAME`: nombre del club que aparecerá en el asunto y cuerpo.
- `TIMEZONE`: zona horaria de salida. Por defecto `Europe/Madrid`.
- `POLL_INTERVAL_MS`: intervalo entre consultas. Mínimo `60000`.
- `PROCESSED_BOOKINGS_FILE`: ruta alternativa para el archivo de IDs procesados.

## Modos de uso

### Monitor continuo

```bash
npm start
```

### Una sola ejecución

```bash
npm run start:once
```

### Verificación de correo

```bash
npm run verify:smtp
```

## Despliegue con Docker

### Construir

```bash
docker build -t playtomic-booking-monitor .
```

### Ejecutar

```bash
docker run -d \
  --name playtomic-booking-monitor \
  --env-file .env \
  -v "$(pwd)/data:/app/data" \
  --restart unless-stopped \
  playtomic-booking-monitor
```

### Usar `docker-compose`

```bash
cp docker-compose.example.yml docker-compose.yml
docker compose up -d --build
```

## Instalar como servicio en Linux

Hay un ejemplo en:

- `deploy/systemd/playtomic-booking-monitor.service.example`

Pasos típicos:

1. Copia el proyecto a `/opt/playtomic-booking-monitor`.
2. Instala dependencias con `npm install --omit=dev`.
3. Crea `/opt/playtomic-booking-monitor/.env`.
4. Copia el archivo `.service` a `/etc/systemd/system/playtomic-booking-monitor.service`.
5. Ajusta la ruta de `node` si hace falta.
6. Ejecuta:

```bash
sudo systemctl daemon-reload
sudo systemctl enable playtomic-booking-monitor
sudo systemctl start playtomic-booking-monitor
sudo systemctl status playtomic-booking-monitor
```

## Estructura

```text
playtomic-booking-monitor/
├── data/
│   └── processed-bookings.json
├── deploy/systemd/
│   └── playtomic-booking-monitor.service.example
├── src/
│   ├── bookingFormatter.js
│   ├── config.js
│   ├── index.js
│   ├── mailer.js
│   ├── monitor.js
│   ├── playtomic.js
│   └── storage.js
├── .dockerignore
├── .env.example
├── .gitignore
├── Dockerfile
├── docker-compose.example.yml
├── package.json
└── README.md
```

## Cómo venderlo a otros clubs

La app ya está preparada para ser reutilizable. Para cada club solo necesitas:

1. Entregar una carpeta o imagen Docker con esta app.
2. Pedir al club sus credenciales:
   - `PLAYTOMIC_CLIENT_ID`
   - `PLAYTOMIC_CLIENT_SECRET`
   - SMTP o una cuenta de correo transaccional
   - email o emails de destino
3. Rellenar su `.env` con `CLUB_NAME`, emails y credenciales.
4. Desplegar en un servidor pequeño, VPS o contenedor.
5. Ejecutar `npm run verify:smtp` y `npm run start:once` como validación inicial.
6. Dejarlo corriendo como servicio o contenedor.

## Recomendaciones para comercializarlo mejor

- Crea una versión por cliente usando solo `.env`, no forks del código.
- Guarda el archivo `data/processed-bookings.json` en un volumen persistente.
- Ofrece instalación estándar con Docker para reducir incidencias.
- Añade una cuenta de correo dedicada por club o un proveedor transaccional.
- Si quieres escalarlo, el siguiente paso natural es un panel web para alta de clubs, logs y configuración centralizada.

## Notas técnicas

- La API de reservas se consulta una vez por minuto.
- Los timestamps se convierten con `Intl.DateTimeFormat`.
- El formateador intenta adaptarse a variantes habituales de nombres de campo en la respuesta de reservas.
- Si borras `data/processed-bookings.json`, las reservas actuales podrán volver a notificarse.
