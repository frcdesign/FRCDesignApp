/** HMAC signatures, for urls we hand out and must recognize without storing them. */

const encoder = new TextEncoder();

function importKey(secret: string): Promise<CryptoKey> {
    return crypto.subtle.importKey(
        "raw",
        encoder.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign", "verify"]
    );
}

function toHex(bytes: ArrayBuffer): string {
    return Array.from(new Uint8Array(bytes), (byte) =>
        byte.toString(16).padStart(2, "0")
    ).join("");
}

function fromHex(hex: string): ArrayBuffer | undefined {
    if (!/^(?:[0-9a-f]{2})+$/.test(hex)) {
        return undefined;
    }
    const pairs = hex.match(/../g) ?? [];
    return new Uint8Array(pairs.map((pair) => parseInt(pair, 16))).buffer;
}

export async function sign(secret: string, value: string): Promise<string> {
    const key = await importKey(secret);
    return toHex(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

/** Constant-time, as `verify` is. */
export async function verify(
    secret: string,
    value: string,
    signature: string
): Promise<boolean> {
    const bytes = fromHex(signature);
    if (!bytes) {
        return false;
    }
    const key = await importKey(secret);
    return crypto.subtle.verify("HMAC", key, bytes, encoder.encode(value));
}
