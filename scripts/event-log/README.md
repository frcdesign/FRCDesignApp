# Event log

Sets up an environment's analytics event log, a Pipelines stream that writes an
Iceberg table to R2, and moves the events D1 held into it.
[analytics.md](../../docs/architecture/analytics.md) describes the log under
**Storage**.

For each environment (`cert`, `prod`), in this order:

1. **Create it.** Signed in to the FRCDesign.org account (`npx wrangler login`),
   with an API token that has R2 Storage Admin Read & Write and R2 Data Catalog
   Read & Write. The sink keeps the token to write the table.

    ```sh
    CATALOG_TOKEN=… scripts/event-log/setup.sh cert
    ```

2. **Bind it.** Put the stream's id in that environment's `pipelines` in
   `wrangler.jsonc`, as `EVENT_LOG`, and deploy. From then on tracking sends
   every event to the stream, and nothing writes D1's `events`.

3. **Move D1's events.** With a token that has D1 Edit, and one that has
   Workers Pipelines Send for the stream's HTTP endpoint:

    ```sh
    CLOUDFLARE_ACCOUNT_ID=… CLOUDFLARE_API_TOKEN=… PIPELINE_TOKEN=… \
        npx tsx scripts/event-log/move-events.ts --database <d1-id> --stream <stream-id>
    ```

    It sends every row to the stream and fills `daily_feature_users` from
    them. It prints the last rowid of each page: after a failure, run it again
    with `--after` that rowid. A page sent twice is two copies in the log.

4. **Drop D1's `events`**, in a migration, once the move has finished on
   every environment.

The first rows reach the table three to seven minutes after the first send;
later files land every five minutes.
