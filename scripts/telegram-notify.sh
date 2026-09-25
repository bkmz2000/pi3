#!/usr/bin/env bash
# Send one message to the configured Telegram chat. Never print or pass the bot
# token in curl's argv; it is supplied through a private process-substitution fd.
set -euo pipefail

CONFIG_FILE=${PI3_BACKUP_ENV_FILE:-/etc/pi3-backup.env}
if [ -r "$CONFIG_FILE" ]; then
  # shellcheck disable=SC1090
  . "$CONFIG_FILE"
fi

BOT_TOKEN=${TELEGRAM_BOT_TOKEN:-}
CHAT_ID=${TELEGRAM_CHAT_ID:-}
MESSAGE=${1:?usage: telegram-notify.sh <message>}

[[ "$BOT_TOKEN" =~ ^[0-9]{5,}:[A-Za-z0-9_-]{20,}$ ]] || {
  echo 'ERROR: TELEGRAM_BOT_TOKEN is missing or malformed' >&2
  exit 1
}
[[ "$CHAT_ID" =~ ^-?[0-9]+$ || "$CHAT_ID" =~ ^@[A-Za-z0-9_]{5,}$ ]] || {
  echo 'ERROR: TELEGRAM_CHAT_ID is missing or malformed' >&2
  exit 1
}
[ "${#MESSAGE}" -le 4000 ] || {
  echo 'ERROR: Telegram message exceeds the supported length' >&2
  exit 1
}

response=$(curl --silent --show-error --fail --max-time 15 \
  --config <(printf 'url = "https://api.telegram.org/bot%s/sendMessage"\n' "$BOT_TOKEN") \
  --data-urlencode "chat_id=$CHAT_ID" \
  --data-urlencode "text=$MESSAGE")
printf '%s' "$response" | python3 -c 'import json,sys; data=json.load(sys.stdin); sys.exit(0 if data.get("ok") is True else 1)'
