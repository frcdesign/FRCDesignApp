# Event log

Sets up an environment's analytics event log, a Pipelines stream that writes an
Iceberg table to R2.
[analytics.md](../../docs/architecture/analytics.md) describes the log under
**Storage**.

For each environment (`cert`, `prod`), in this order:

1. **Create it.** Signed in to the FRCDesign.org account (`npx wrangler login`),
   with an API token that has Workers R2 Storage Edit and Basin Catalog Edit
   (formerly R2 Data Catalog). The sink keeps the token to write the table.

    ```sh
    CATALOG_TOKEN=… scripts/event-log/setup.sh cert
    ```

2. **Bind it.** Put the stream's id in that environment's `pipelines` in
   `wrangler.jsonc`, as `EVENT_LOG`, and deploy. From then on tracking sends
   every event to the stream.

The first rows reach the table three to seven minutes after the first send;
later files land every five minutes.
