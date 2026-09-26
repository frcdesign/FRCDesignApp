import { create, type StoreApi, type UseBoundStore } from "zustand";
import { persist, type PersistStorage } from "zustand/middleware";
import type * as z from "zod";

/**
 * The fields as a plain object, the shape stored before these were Zustand
 * stores. Blocked or partitioned storage costs only the memory, never the app.
 */
function plainStorage<T>(getStorage: () => Storage): PersistStorage<T> {
    return {
        getItem: (name) => {
            try {
                const raw = getStorage().getItem(name);
                return raw ? { state: JSON.parse(raw) as T, version: 0 } : null;
            } catch {
                return null;
            }
        },
        setItem: (name, value) => {
            try {
                getStorage().setItem(name, JSON.stringify(value.state));
            } catch {
                // The store in memory still serves this session.
            }
        },
        removeItem: (name) => {
            try {
                getStorage().removeItem(name);
            } catch {
                // As above.
            }
        }
    };
}

/**
 * A store kept under `name`. `schema` gives each field its default, so what
 * is stored is parsed field by field and one stale value resets only itself.
 */
export function createPersistedStore<T extends z.ZodObject>(
    schema: T,
    name: string,
    getStorage: () => Storage
): UseBoundStore<StoreApi<z.infer<T>>> {
    const parse = (stored: unknown): z.infer<T> => {
        const parsed = schema.safeParse(stored ?? {});
        return parsed.success ? parsed.data : schema.parse({});
    };
    return create<z.infer<T>>()(
        persist(() => parse({}), {
            name,
            storage: plainStorage(getStorage),
            merge: (stored, current) => ({ ...current, ...parse(stored) })
        })
    );
}
