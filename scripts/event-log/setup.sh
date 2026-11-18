#!/usr/bin/env bash
# Creates one environment's event log: an R2 bucket with its data catalog, a
# stream, an Iceberg sink and the pipeline between them. Run once per
# environment, signed in to the FRCDesign.org account. See README.md.
set -euo pipefail

ENV="${1:?usage: setup.sh <cert|prod>}"
: "${CATALOG_TOKEN:?set CATALOG_TOKEN to an API token with R2 Storage Admin Read & Write and R2 Data Catalog Read & Write}"

BUCKET="frc-design-app-${ENV}-events"
STREAM="frc_design_app_${ENV}_events"
HERE="$(cd "$(dirname "$0")" && pwd)"

npx wrangler r2 bucket create "$BUCKET"
npx wrangler r2 bucket catalog enable "$BUCKET"
# The HTTP endpoint is for move-events.ts; it takes a token, never anyone.
npx wrangler pipelines streams create "$STREAM" \
    --schema-file "$HERE/stream-schema.json" --http-enabled --http-auth
npx wrangler pipelines sinks create "${STREAM}_sink" \
    --type r2-data-catalog --bucket "$BUCKET" \
    --namespace analytics --table events \
    --catalog-token "$CATALOG_TOKEN" --roll-interval 300
npx wrangler pipelines create "${STREAM}_pipeline" \
    --sql "INSERT INTO ${STREAM}_sink SELECT * FROM ${STREAM}"

echo
echo "Put this stream's id in wrangler.jsonc's \"pipelines\" for the environment:"
npx wrangler pipelines streams list
