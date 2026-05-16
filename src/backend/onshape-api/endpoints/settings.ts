import { OAuthApi } from "../client/oauth-api";
import { UserPath, toUserApiPath } from "../../../shared/path";

/** Gets a setting with a specific key. Returns `null` if the key is not set. */
export async function getSetting(
  client: OAuthApi,
  clientId: string,
  userPath: UserPath,
  key: string,
): Promise<any | null> {
  const result = await getSettings(client, clientId, userPath, [key]);
  if (result.length === 0) return null;
  return result[0]?.value ?? null;
}

/**
 * Returns a list of company or user-level settings with the given keys.
 *
 * Each entry in the result has `key` and `value` fields.
 *
 * @param keys If omitted, all settings are returned.
 */
export async function getSettings(
  client: OAuthApi,
  clientId: string,
  userPath: UserPath,
  keys?: string[],
): Promise<any[]> {
  const query = new URLSearchParams((keys ?? []).map((key) => ["key", key]));
  const result = await client.get(
    `/applications/clients/${clientId}/settings` + toUserApiPath(userPath),
    { query },
  );
  return result.settings;
}

export enum Operation {
  /** Sets the value of the given field. */
  SET = "ADD",
  /** Updates the given field. Throws if it doesn't exist. */
  UPDATE = "UPDATE",
  /** Deletes the given field. */
  REMOVE = "REMOVE",
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
  userPath: UserPath,
  updates: Update[],
): Promise<void> {
  return client.post(
    `/applications/clients/${clientId}/settings` + toUserApiPath(userPath),
    { body: { settings: updates }, isJson: false },
  );
}

/** Applies a single settings update. */
export function updateSetting(
  client: OAuthApi,
  clientId: string,
  userPath: UserPath,
  update: Update,
): Promise<void> {
  return updateSettings(client, clientId, userPath, [update]);
}

/** Sets the value of a given key. */
export function setSetting(
  client: OAuthApi,
  clientId: string,
  userPath: UserPath,
  key: string,
  value: unknown,
): Promise<void> {
  return updateSetting(client, clientId, userPath, { key, value });
}
