/**
 * TEMPORARY: finds which Onshape call starts a configured thumbnail's render.
 * Each probe picks a length nobody has opened, asks insertables for its key,
 * makes one candidate call, then polls the `/c/{key}` thumbnail and reports how
 * long until it loads. Delete once the render path is settled.
 *
 *     ONSHAPE_ACCESS_KEY=… ONSHAPE_SECRET_KEY=… npx tsx scripts/probe-configured-thumbnail.ts
 *
 * Optional: DOCUMENT_ID, WORKSPACE_ID, ELEMENT_ID, LENGTH_ID, LIST_ID, LIST_VALUE
 * to probe another part studio; the defaults are the test part.
 */
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = "https://cad.onshape.com/api/v17";
const env = process.env;
const accessKey = env.ONSHAPE_ACCESS_KEY;
const secretKey = env.ONSHAPE_SECRET_KEY;
if (!accessKey || !secretKey) {
    throw new Error("Set ONSHAPE_ACCESS_KEY and ONSHAPE_SECRET_KEY.");
}
const did = env.DOCUMENT_ID ?? "ec194c001a419592e9fd55fd";
const wid = env.WORKSPACE_ID ?? "c932796bcac2f7e7344a2072";
const eid = env.ELEMENT_ID ?? "8c8050a96ba6021887368f7a";
const lengthId = env.LENGTH_ID ?? "Length";
const listId = env.LIST_ID ?? "List_rOn4qr3JOJf5p0";
const listValue = env.LIST_VALUE ?? "Two";

const POLL_MS = 3000;
const POLL_FOR_MS = 120_000;
const SIZE = "300x300";

const auth = "Basic " + btoa(`${accessKey}:${secretKey}`);

function query(params: Record<string, string>): string {
    return new URLSearchParams(params).toString().replaceAll("+", "%20");
}

async function call(
    method: string,
    path: string,
    params: Record<string, string> = {},
    body?: unknown
): Promise<Response> {
    const search = Object.keys(params).length ? `?${query(params)}` : "";
    return fetch(`${BASE}${path}${search}`, {
        method,
        headers: {
            Authorization: auth,
            Accept: body === undefined ? "*/*" : "application/json",
            ...(body === undefined
                ? {}
                : { "Content-Type": "application/json" })
        },
        body: body === undefined ? undefined : JSON.stringify(body)
    });
}

interface Insertables {
    configurationKey?: string;
    items?: { microversionId?: string }[];
}

interface Part {
    thumbnailInfo?: { sizes?: { href?: string }[] };
}

interface Encoding {
    encodedId: string;
}

interface ShadedViews {
    images?: (string | string[])[];
}

/** Asserted, not parsed: only read for what a person looks at. */
async function json<T>(response: Response): Promise<T> {
    const text = await response.text();
    if (!response.ok) {
        throw new Error(`${response.status}: ${text.slice(0, 300)}`);
    }
    return JSON.parse(text) as T;
}

/** A length in inches with three decimals, so nobody has opened it before. */
function freshLength(): string {
    return `${(20 + Math.random() * 10).toFixed(3)} in`;
}

function configurationOf(length: string): string {
    return `${lengthId}=${length};${listId}=${listValue}`;
}

const elementPath = `/d/${did}/w/${wid}/e/${eid}`;

async function encodedKey(length: string): Promise<{
    key: string;
    microversionId: string;
}> {
    const insertables = await json<Insertables>(
        await call("GET", `/documents/d/${did}/w/${wid}/insertables`, {
            includeParts: "true",
            includeAssemblies: "true",
            includeCompositeParts: "true",
            elementId: eid,
            configuration: configurationOf(length)
        })
    );
    if (!insertables.configurationKey) {
        throw new Error("Insertables named no configurationKey.");
    }
    return {
        key: insertables.configurationKey,
        microversionId: insertables.items?.[0]?.microversionId ?? ""
    };
}

/** Seconds until the configured thumbnail loads, or undefined if it never does. */
async function pollThumbnail(
    key: string,
    microversionId: string
): Promise<number | undefined> {
    const started = Date.now();
    while (Date.now() - started < POLL_FOR_MS) {
        const response = await call(
            "GET",
            `/thumbnails${elementPath}/c/${key}/s/${SIZE}`,
            microversionId ? { t: microversionId, rejectEmpty: "true" } : {}
        );
        await response.arrayBuffer();
        if (response.ok) {
            return Math.round((Date.now() - started) / 1000);
        }
        await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    }
    return undefined;
}

type Trigger = (length: string) => Promise<string>;

/** Each makes one candidate call and says what Onshape answered. */
const TRIGGERS: Record<string, Trigger> = {
    "insertables only": () => Promise.resolve("nothing else called"),

    "parts?configuration": async (length) => {
        const parts = await json<Part[]>(
            await call("GET", `/parts${elementPath}`, {
                configuration: configurationOf(length)
            })
        );
        return `${parts.length} parts`;
    },

    "parts?withThumbnails": async (length) => {
        const parts = await json<Part[]>(
            await call("GET", `/parts${elementPath}`, {
                configuration: configurationOf(length),
                withThumbnails: "true"
            })
        );
        return `${parts.length} parts, thumbnail ${JSON.stringify(parts[0]?.thumbnailInfo?.sizes?.[0]?.href ?? parts[0]?.thumbnailInfo ?? "none").slice(0, 200)}`;
    },

    "configurationencodings, then /ac/ thumbnail": async (length) => {
        const encoding = await json<Encoding>(
            await call(
                "POST",
                `/elements/d/${did}/e/${eid}/configurationencodings`,
                {},
                {
                    parameters: [
                        { parameterId: lengthId, parameterValue: length },
                        { parameterId: listId, parameterValue: listValue }
                    ]
                }
            )
        );
        const thumbnail = await call(
            "GET",
            `/thumbnails${elementPath}/ac/${encodeURIComponent(encoding.encodedId)}/s/${SIZE}`,
            { requireConfigMatch: "true", rejectEmpty: "true" }
        );
        await thumbnail.arrayBuffer();
        return `encodedId ${encoding.encodedId}; /ac/ answered ${thumbnail.status}`;
    },

    "partstudios shadedviews": async (length) => {
        const views = await json<ShadedViews>(
            await call("GET", `/partstudios${elementPath}/shadedviews`, {
                configuration: configurationOf(length),
                viewMatrix: "isometric",
                outputHeight: "300",
                outputWidth: "300",
                pixelSize: "0"
            })
        );
        // The spec types each image as a byte array, which arrives as base64.
        const first = views.images?.[0];
        const image = Array.isArray(first) ? first[0] : first;
        if (image) {
            mkdirSync("out", { recursive: true });
            writeFileSync(
                `out/shadedview-${length.replace(/\W+/g, "_")}.png`,
                Buffer.from(image, "base64")
            );
        }
        return image
            ? `an image, saved under out/ (${image.length} base64 chars)`
            : "no image";
    }
};

async function probe(name: string, trigger: Trigger): Promise<string> {
    const length = freshLength();
    try {
        const { key, microversionId } = await encodedKey(length);
        const answered = await trigger(length);
        const seconds = await pollThumbnail(key, microversionId);
        const result =
            seconds === undefined
                ? `never loaded in ${POLL_FOR_MS / 1000}s`
                : `loaded after ${seconds}s`;
        return `${name} (${length}): ${answered}; thumbnail ${result}`;
    } catch (error) {
        return `${name} (${length}): failed, ${String(error)}`;
    }
}

const results = await Promise.all(
    Object.entries(TRIGGERS).map(([name, trigger]) => probe(name, trigger))
);
console.log(results.join("\n"));
