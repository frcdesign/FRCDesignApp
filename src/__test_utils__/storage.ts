import { env } from "cloudflare:workers";

/** Empties D1's tables, KV and R2, leaving D1 as freshly migrated. */
export async function resetStorage(): Promise<void> {
    const { results: tables } = await env.DB.prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name != 'd1_migrations'"
    ).all<{ name: string }>();
    await env.DB.batch([
        env.DB.prepare("PRAGMA defer_foreign_keys = on"),
        ...tables.map(({ name }) => env.DB.prepare(`DELETE FROM "${name}"`))
    ]);

    let cursor: string | undefined;
    do {
        const page = await env.KV.list({ cursor });
        await Promise.all(page.keys.map(({ name }) => env.KV.delete(name)));
        cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);

    do {
        const page = await env.BLOB.list({ cursor });
        if (page.objects.length > 0) {
            await env.BLOB.delete(page.objects.map(({ key }) => key));
        }
        cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
}
