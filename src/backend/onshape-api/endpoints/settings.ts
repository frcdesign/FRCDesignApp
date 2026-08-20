import { OAuthApi } from "../onshape-api";

/** Gets a setting with a specific key. Returns `null` if the key is not set. */
export async function getSetting(
    client: OAuthApi,
    clientId: string,
    userId: string,
    key: string
): Promise<any> {
    const result = await getSettings(client, clientId, userId, [key]);
    if (result.length === 0) return null;
    return result[0]?.value ?? null;
}

/** Company or user-level settings; omitting `keys` returns all of them. */
export async function getSettings(
    client: OAuthApi,
    clientId: string,
    userId: string,
    keys?: string[]
): Promise<any[]> {
    const query = new URLSearchParams((keys ?? []).map((key) => ["key", key]));
    const result = await client.get(
        `/applications/clients/${clientId}/settings/users/${userId}`,
        { query }
    );
    return result.settings;
}

export enum Operation {
    /** Sets the value of the given field. */
    SET = "ADD",
    /** Updates the given field. Throws if it doesn't exist. */
    UPDATE = "UPDATE",
    /** Deletes the given field. */
    REMOVE = "REMOVE"
}

export interface Update {
    key: string;
    value?: unknown;
    field?: string;
    operation?: Operation;
}

export function updateSettings(
    client: OAuthApi,
    clientId: string,
    userId: string,
    updates: Update[]
): Promise<void> {
    return client.postNone(
        `/applications/clients/${clientId}/settings/users/${userId}`,
        { body: { settings: updates } }
    );
}

/** Applies a single settings update. */
export function updateSetting(
    client: OAuthApi,
    clientId: string,
    userId: string,
    update: Update
): Promise<void> {
    return updateSettings(client, clientId, userId, [update]);
}

/** Sets the value of a given key. */
export function setSetting(
    client: OAuthApi,
    clientId: string,
    userId: string,
    key: string,
    value: unknown
): Promise<void> {
    return updateSetting(client, clientId, userId, { key, value });
}
