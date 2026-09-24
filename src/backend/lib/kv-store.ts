/**
 * Every KV key belongs to one of these, so the namespace stays a set of
 * declared stores rather than keys written from anywhere. Values are JSON.
 */
export interface KvStore<T> {
    get(kv: KVNamespace, id: string): Promise<T | undefined>;
    put(kv: KVNamespace, id: string, value: T): Promise<void>;
    delete(kv: KVNamespace, id: string): Promise<void>;
}

interface KvStoreOptions {
    /** Omitted, entries last until deleted. */
    ttlSeconds?: number;
}

export function kvStore<T>(
    prefix: string,
    options: KvStoreOptions = {}
): KvStore<T> {
    const key = (id: string) => `${prefix}:${id}`;
    return {
        async get(kv, id) {
            try {
                return (await kv.get<T>(key(id), "json")) ?? undefined;
            } catch {
                // Written in another shape; a miss is what to make of it.
                return undefined;
            }
        },
        put(kv, id, value) {
            return kv.put(key(id), JSON.stringify(value), {
                expirationTtl: options.ttlSeconds
            });
        },
        delete(kv, id) {
            return kv.delete(key(id));
        }
    };
}
