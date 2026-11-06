import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { beforeEach } from "vitest";

// Storage outlives a test: the pool keeps it per file, and files share a runtime
// (`isolate: false` in vitest.config.ts). So every test starts from empty storage.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);

beforeEach(async () => {
    await Promise.all([emptyD1(env.DB), emptyKv(env.KV), emptyR2(env.BLOB)]);
});

async function emptyD1(db: D1Database): Promise<void> {
    const { results } = await db
        .prepare(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name != 'd1_migrations'"
        )
        .all<{ name: string }>();
    // One batch is one transaction, so foreign keys are checked only once every row is gone.
    await db.batch([
        db.prepare("PRAGMA defer_foreign_keys = on"),
        ...results.map(({ name }) => db.prepare(`DELETE FROM "${name}"`))
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
