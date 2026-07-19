#!/bin/zsh
set -e

cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Falta Node.js. Instalalo desde https://nodejs.org y vuelve a abrir este archivo."
  read "?Pulsa Enter para cerrar..."
  exit 1
fi

echo "Instalando el radar de pistas..."
npm install
npx playwright install chromium

echo ""
read -s "TELEGRAM_TOKEN?Pega el token del bot de Telegram (no se mostrara): "
echo ""

if [ -z "$TELEGRAM_TOKEN" ]; then
  echo "No se ha introducido ningun token."
  exit 1
fi

echo "Envia ahora un mensaje cualquiera en el grupo de Telegram donde has anadido el bot."
read "?Cuando lo hayas enviado, pulsa Enter..."

TELEGRAM_CHAT_ID=$(TELEGRAM_TOKEN="$TELEGRAM_TOKEN" node --input-type=module -e '
  const token = process.env.TELEGRAM_TOKEN;
  const response = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
  const payload = await response.json();
  if (!payload.ok) process.exit(2);
  const chats = payload.result.flatMap((update) => [update.message?.chat, update.my_chat_member?.chat]).filter((chat) => chat && ["group", "supergroup"].includes(chat.type));
  const chat = chats.at(-1);
  if (!chat) process.exit(3);
  process.stdout.write(String(chat.id));
') || true

if [ -z "$TELEGRAM_CHAT_ID" ]; then
  echo "No he podido detectar el grupo. Comprueba que el bot este dentro y vuelve a ejecutar el instalador."
  exit 1
fi

cat > .env <<EOF
CLUB_NAME=Freedom Wellness XX Padel Club
TIMEZONE=Europe/Madrid
BOOKING_URL=https://playtomic.com/clubs/freedom-wellness-xx-padel-club
PLAYTOMIC_TENANT_ID=838146b1-c519-4000-82fa-017fc76304f5
TELEGRAM_BOT_TOKEN=$TELEGRAM_TOKEN
TELEGRAM_CHAT_ID=$TELEGRAM_CHAT_ID
DRY_RUN=true
EOF
chmod 600 .env

echo ""
echo "Grupo detectado: $TELEGRAM_CHAT_ID"
echo "Ejecutando una prueba sin enviar mensajes..."
npm start

echo ""
echo "Prueba terminada. Si los horarios son correctos, abre activar-mac.command."
read "?Pulsa Enter para cerrar..."
