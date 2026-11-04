import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";

// Test files share a runtime and its storage (`isolate: false` in vitest.config.ts),
// so each file empties D1, KV and R2 before migrating, as a fresh runtime would be.
await emptyD1(env.DB);
await emptyKv(env.KV);
await emptyR2(env.BLOB);
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);

async function emptyD1(db: D1Database): Promise<void> {
    const { results } = await db
        .prepare(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'"
        )
        .all<{ name: string }>();
    if (results.length === 0) return;
    // One batch is one transaction, so foreign keys are checked only once every table is gone.
    await db.batch([
        db.prepare("PRAGMA defer_foreign_keys = on"),
        ...results.map(({ name }) => db.prepare(`DROP TABLE "${name}"`))
    ]);
}

async function emptyKv(kv: KVNamespace): Promise<void> {
    let cursor: string | undefined;
    do {
        const page = await kv.list({ cursor });
        await Promise.all(page.keys.map((key) => kv.delete(key.name)));
        cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
}

async function emptyR2(bucket: R2Bucket): Promise<void> {
    let cursor: string | undefined;
    do {
        const page = await bucket.list({ cursor });
        if (page.objects.length > 0) {
            await bucket.delete(page.objects.map((object) => object.key));
        }
        cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
}
