import { useLoaderData } from "@tanstack/react-router";
import { createSearchParams, URLSearchParamsInit } from "../common/utils";
import { hasEditorAccess } from "../../shared/types";
import { AccessLevel } from "../../shared/types";
import { HandledError } from "./errors";

function getUrl(
  path: string,
  query?: URLSearchParamsInit,
  cacheOptions?: CacheOptions,
): string {
  const searchParams = createSearchParams(query);
  if (cacheOptions) {
    if (hasEditorAccess(cacheOptions.currentAccessLevel)) {
      // Makes the path /api/admin/...
      path = "/admin" + path;
    } else {
      // Append the v parameter to bust the cache when the cache version changes
      searchParams.append("v", cacheOptions.cacheVersion.toString());
    }
  }

  return "/api" + path + `?${searchParams}`;
}

interface QueryOptions {
  query?: URLSearchParamsInit;
  signal?: AbortSignal;
}

interface PostOptions extends QueryOptions {
  body?: object;
}

/**
 * Makes a post request to a backend /api route.
 */
export async function apiPost(
  path: string,
  options?: PostOptions,
): Promise<any> {
  return fetch(getUrl(path, options?.query), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options?.body ?? {}),
    signal: options?.signal,
  }).then(handleResponse);
}

export interface CacheOptions {
  currentAccessLevel: AccessLevel;
  cacheVersion: number;
}

export function toCacheOptions(cacheOptions: CacheOptions): CacheOptions {
  return {
    currentAccessLevel: cacheOptions.currentAccessLevel,
    cacheVersion: cacheOptions.cacheVersion,
  };
}

export function useCacheOptions(): CacheOptions {
  const loaderData = useLoaderData({ from: "/app" });
  return {
    currentAccessLevel: loaderData.currentAccessLevel,
    cacheVersion: loaderData.cacheVersion,
  };
}

interface QueryOptionsWithCache extends QueryOptions {
  cacheOptions?: CacheOptions;
}

/**
 * Makes a get request to a backend /api route.
 */
export async function apiGet(
  path: string,
  options?: QueryOptionsWithCache,
): Promise<any> {
  return fetch(getUrl(path, options?.query, options?.cacheOptions), {
    signal: options?.signal,
  }).then(handleResponse);
}

export async function apiGetRawImage(
  url: string,
  signal?: AbortSignal,
): Promise<string> {
  return fetch(url, {
    signal,
  }).then(handleImageResponse);
}

/**
 * Makes a get request for an image to a backend /api route.
 * Returns a local url for the image.
 */
export async function apiGetImage(
  path: string,
  options?: QueryOptionsWithCache,
): Promise<string> {
  return fetch(getUrl(path, options?.query, options?.cacheOptions), {
    signal: options?.signal,
  }).then(handleImageResponse);
}

async function handleImageResponse(response: Response) {
  if (!response.ok) {
    throw new Error("Network response failed.");
  }
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

/**
 * Makes a delete request to a backend /api route.
 */
export async function apiDelete(
  path: string,
  options?: QueryOptions,
): Promise<any> {
  return fetch(getUrl(path, options?.query), {
    method: "DELETE",
    signal: options?.signal,
  }).then(handleResponse);
}

async function handleResponse(response: Response) {
  const json = (await response.json()) as any;
  if (!response.ok) {
    if (json.type === "handled") {
      throw new HandledError(json.message, json.isError);
    }
    throw new Error("Network response failed.");
  }
  return json;
}
