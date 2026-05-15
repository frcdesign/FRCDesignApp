import { createHmac, randomBytes } from "node:crypto";
import { OnshapeApi } from "./onshape-api";

export class KeyApi extends OnshapeApi {
    constructor(accessKey: string, secretKey: string) {
        super({
            hooks: {
                beforeRequest: [
                    ({ request }) => {
                        const headers = makeSignedHeaders(
                            request.method,
                            request.url,
                            accessKey,
                            secretKey
                        );
                        for (const [key, value] of Object.entries(headers)) {
                            request.headers.set(key, value);
                        }
                    }
                ]
            }
        });
    }

    /**
     * Creates a key client by reading `API_ACCESS_KEY` and `API_SECRET_KEY` from the environment.
     * `API_BASE_URL` and `API_VERSION` are also read if present.
     * Pass `{ loadDotenv: true }` (the default) to load a `.env` file first.
     */
    static async fromEnv({
        loadDotenv = true
    }: { loadDotenv?: boolean } = {}): Promise<KeyApi> {
        if (loadDotenv) {
            const { config } = await import("dotenv");
            config();
        }
        const accessKey = process.env.API_ACCESS_KEY;
        const secretKey = process.env.API_SECRET_KEY;
        if (!accessKey) throw new Error("API_ACCESS_KEY is required");
        if (!secretKey) throw new Error("API_SECRET_KEY is required");
        return new KeyApi(accessKey, secretKey);
    }
}

function makeSignedHeaders(
    method: string,
    url: string,
    accessKey: string,
    secretKey: string
): Record<string, string> {
    const date = new Date().toUTCString();
    const nonce = randomBytes(12).toString("hex");
    const contentType = "application/json";

    const parsed = new URL(url);
    const stringToSign = [
        method,
        nonce,
        date,
        contentType,
        parsed.pathname,
        parsed.search.replace(/^\?/, "")
    ]
        .join("\n")
        .toLowerCase();

    const signature = createHmac("sha256", secretKey)
        .update(stringToSign)
        .digest("base64");

    return {
        Date: date,
        "On-Nonce": nonce,
        Authorization: `On ${accessKey}:HmacSHA256:${signature}`,
        "Content-Type": contentType,
        Accept: "application/json"
    };
}
