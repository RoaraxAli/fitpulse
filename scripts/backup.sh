#!/usr/bin/env bash
# Dump the FitPulse database into ./backups as a gzip archive and prune old copies.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_NAME="${MONGODB_DB:-fitpulse}"
OUT_DIR="${BACKUP_DIR:-$ROOT/backups}"
KEEP="${BACKUP_KEEP:-14}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

mkdir -p "$OUT_DIR"

if command -v mongodump >/dev/null 2>&1; then
  ARCHIVE="$OUT_DIR/fitpulse-$STAMP.archive.gz"
  mongodump --uri="${MONGODB_URI:-mongodb://127.0.0.1:27017}" --db="$DB_NAME" --archive="$ARCHIVE" --gzip --quiet
  echo "Wrote $ARCHIVE"
else
  # mongodump is not installed: fall back to a JSON snapshot of every collection.
  ARCHIVE="$OUT_DIR/fitpulse-$STAMP.json.gz"
  node -e '
    const { MongoClient } = require("mongodb");
    const { gzipSync } = require("node:zlib");
    const fs = require("node:fs");
    (async () => {
      const client = new MongoClient(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017");
      await client.connect();
      const db = client.db(process.env.MONGODB_DB || "fitpulse");
      const names = (await db.listCollections().toArray()).map((c) => c.name);
      const dump = {};
      for (const name of names) dump[name] = await db.collection(name).find({}).toArray();
      fs.writeFileSync(process.argv[1], gzipSync(Buffer.from(JSON.stringify(dump))));
      await client.close();
    })().catch((error) => { console.error(error); process.exit(1); });
  ' "$ARCHIVE"
  echo "Wrote $ARCHIVE"
fi

# Drop backups beyond the retention window (oldest first).
ls -1t "$OUT_DIR"/fitpulse-* 2>/dev/null | tail -n "+$((KEEP + 1))" | while read -r old; do
  rm -f "$old"
  echo "Pruned $old"
done
