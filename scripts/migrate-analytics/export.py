"""Exports the legacy app's usage log from BigQuery as one JSON object per line.

    GCP_ACCESS_TOKEN=$(gcloud auth print-access-token) \\
        python3 scripts/migrate-analytics/export.py out/legacy-events.jsonl

The Cloud Run app wrote each insert and app open to Cloud Logging, tagged
`source: frc-design-app-data` and routed to a log bucket that BigQuery links as
`frc_design_app_data`. See README.md beside this file.
"""

import json
import os
import subprocess
import sys
import urllib.request

PROJECT = "frc-design-lib"
API = f"https://bigquery.googleapis.com/bigquery/v2/projects/{PROJECT}"
PAGE_ROWS = 20_000

# Cloud Logging retries a write under the same insert_id, so a few entries
# arrive twice; the first copy is kept.
QUERY = """
SELECT
  insert_id AS id,
  UNIX_MILLIS(timestamp) AS created_at,
  JSON_VALUE(json_payload, '$.message') AS message,
  JSON_VALUE(json_payload, '$.userId') AS user_id,
  JSON_VALUE(json_payload, '$.library') AS library,
  JSON_VALUE(json_payload, '$.elementId') AS element_id,
  JSON_VALUE(json_payload, '$.name') AS name,
  JSON_VALUE(json_payload, '$.version.id') AS version_id,
  JSON_VALUE(json_payload, '$.targetElementType') AS target,
  JSON_VALUE(json_payload, '$.isFavorite') AS is_favorite,
  JSON_VALUE(json_payload, '$.quickInsert') AS quick_insert,
  JSON_VALUE(json_payload, '$.fasten') AS fasten,
  TO_JSON_STRING(ARRAY(
    SELECT AS STRUCT
      JSON_VALUE(c, '$.id') AS id,
      JSON_VALUE(c, '$.type') AS type,
      JSON_VALUE(c, '$.value') AS value
    FROM UNNEST(JSON_QUERY_ARRAY(json_payload, '$.configuration')) AS c
  )) AS configuration
FROM `frc-design-lib.frc_design_app_data._AllLogs`
WHERE JSON_VALUE(json_payload, '$.source') = 'frc-design-app-data'
  AND JSON_VALUE(json_payload, '$.message') IN ('Part inserted', 'App opened')
QUALIFY ROW_NUMBER() OVER (PARTITION BY insert_id ORDER BY timestamp) = 1
"""


def token() -> str:
    found = os.environ.get("GCP_ACCESS_TOKEN")
    if found:
        return found
    return subprocess.run(
        ["gcloud", "auth", "print-access-token"],
        capture_output=True,
        text=True,
        check=True,
    ).stdout.strip()


def call(method: str, path: str, body: dict | None = None) -> dict:
    request = urllib.request.Request(
        API + path,
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={
            "Authorization": f"Bearer {token()}",
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(request, timeout=300) as response:
        return json.load(response)


def rows(page: dict, names: list[str]):
    for row in page.get("rows", []):
        yield {name: cell["v"] for name, cell in zip(names, row["f"])}


def main(out_path: str) -> None:
    job = call(
        "POST",
        "/jobs",
        {
            "configuration": {
                "query": {"query": QUERY, "useLegacySql": False}
            }
        },
    )
    job_id = job["jobReference"]["jobId"]
    location = job["jobReference"]["location"]
    results = f"/queries/{job_id}?location={location}&maxResults={PAGE_ROWS}"

    page = call("GET", results + "&timeoutMs=300000")
    while not page.get("jobComplete"):
        page = call("GET", results + "&timeoutMs=300000")
    total = int(page["totalRows"])
    names = [field["name"] for field in page["schema"]["fields"]]

    written = 0
    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as out:
        while True:
            for row in rows(page, names):
                out.write(json.dumps(row, separators=(",", ":")) + "\n")
                written += 1
            print(f"{written:,} / {total:,}", file=sys.stderr)
            next_token = page.get("pageToken")
            if not next_token:
                break
            page = call("GET", results + f"&pageToken={next_token}")

    if written != total:
        sys.exit(f"wrote {written:,} rows, but the query returned {total:,}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("usage: export.py <out.jsonl>")
    main(sys.argv[1])
