#!/bin/bash
set -euo pipefail
IFS=$'\n\t'

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}[Update DB] Starting GTFS database update...${NC}"

cd "$(dirname "$0")"

# Load environment
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

if [ -z "${API_511_KEY:-}" ]; then
  echo -e "${RED}[Update DB] Error: API_511_KEY not set${NC}"
  exit 1
fi

# Ensure dependencies exist
for cmd in curl unzip npm; do
  command -v "$cmd" &>/dev/null || { echo -e "${RED}Missing $cmd${NC}"; exit 1; }
done

# Lock file (avoid concurrency)
LOCKFILE="/tmp/update-gtfs.lock"
[ -f "$LOCKFILE" ] && { echo -e "${RED}[Update DB] Already running${NC}"; exit 1; }
trap 'rm -f "$LOCKFILE"' EXIT
touch "$LOCKFILE"

# Temp and cache dirs
TEMP_DIR="cache/temp"
mkdir -p "$TEMP_DIR"

GTFS_URL="https://api.511.org/transit/datafeeds?api_key=${API_511_KEY}&operator_id=RG"

echo -e "${BLUE}[Update DB] Downloading GTFS feed...${NC}"
curl -fL -o "$TEMP_DIR/gtfs.zip" "$GTFS_URL"

unzip -tq "$TEMP_DIR/gtfs.zip" >/dev/null || { echo -e "${RED}[Update DB] Invalid zip${NC}"; exit 1; }

echo -e "${BLUE}[Update DB] Extracting files...${NC}"
unzip -q -o "$TEMP_DIR/gtfs.zip" -d "$TEMP_DIR"

for file in stops routes trips stop_times; do
  [ -f "$TEMP_DIR/${file}.txt" ] || { echo -e "${RED}[Update DB] Missing ${file}.txt${NC}"; exit 1; }
  mv "$TEMP_DIR/${file}.txt" cache/
done

rm -rf "$TEMP_DIR"

echo -e "${BLUE}[Update DB] Importing data...${NC}"
npx tsx cache/import-gtfs.ts

echo -e "${BLUE}[Update DB] Cleaning up...${NC}"
rm -f cache/{stops,routes,trips,stop_times}.txt

echo -e "${GREEN}[Update DB] Database update complete!${NC}"
