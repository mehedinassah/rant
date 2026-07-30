#!/bin/sh
# Applies pending migrations, then starts the API. Running migrate deploy on boot
# keeps the schema in lockstep with the image in every environment.
set -e

cd /app
echo "▸ applying database migrations…"
node_modules/.bin/prisma migrate deploy --schema packages/database/prisma/schema.prisma

echo "▸ starting rant API…"
cd /app/apps/api
exec node dist/main.js
