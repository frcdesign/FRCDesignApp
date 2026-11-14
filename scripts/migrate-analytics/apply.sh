#!/bin/bash
# Applies build-sql.ts's files to a remote D1 in order, one import each.
#
#     scripts/migrate-analytics/apply.sh production out/analytics
#
# Safe to run again after a failure: a file whose first event the target already
# holds landed whole, and is skipped. The Cloudflare API rate-limits imports
# (code 971), so files are spaced out and a refused one is retried.
set -u
env="$1"
dir="$2"
log=$(mktemp)
trap 'rm -f "$log"' EXIT

# The id of the first event a file inserts.
first_event() {
    head -c 4000 "$1" | grep -oE "VALUES \('legacy-[0-9a-f]+'" | head -1 | grep -oE "legacy-[0-9a-f]+"
}

applied() {
    for wait in 30 60 120; do
        count=$(npx wrangler d1 execute DB --env "$env" --remote --json \
            --command "SELECT COUNT(*) AS n FROM events WHERE id = '$1'" 2>/dev/null |
            grep -oE '"n": [0-9]+' | grep -oE '[0-9]+')
        if [ -n "$count" ]; then
            [ "$count" -eq 1 ]
            return
        fi
        sleep "$wait"
    done
    echo "could not read the target to check $1" >&2
    exit 1
}

for file in "$dir"/*.sql; do
    name=$(basename "$file")
    id=$(first_event "$file")
    if [ -z "$id" ]; then
        echo "$name: no event to check it by; stopping" >&2
        exit 1
    fi
    if applied "$id"; then
        echo "$name: already applied"
        continue
    fi
    for wait in 30 60 120 0; do
        start=$(date +%s)
        if npx wrangler d1 execute DB --env "$env" --remote --yes --file="$file" >"$log" 2>&1; then
            echo "$name: applied in $(($(date +%s) - start)) s"
            break
        fi
        if grep -q "code: 971" "$log" && [ "$wait" -gt 0 ]; then
            echo "$name: rate-limited, retrying in $wait s"
            sleep "$wait"
            continue
        fi
        echo "$name: failed" >&2
        grep -E "ERROR|code:" "$log" >&2
        exit 1
    done
    sleep 15
done
echo "every file applied to $env"
