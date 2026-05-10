import { baseUrlFromEnv, OnshapeBaseClient, ONSHAPE_BASE_URL } from "./client";

export class OAuthClient extends OnshapeBaseClient {
    constructor(accessToken: string, baseUrl = ONSHAPE_BASE_URL) {
        super(
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                    Accept: "application/json"
                }
            },
            baseUrl
        );
    }

    static fromEnv(): OAuthClient {
        const accessToken = process.env.ONSHAPE_ACCESS_TOKEN;
        if (!accessToken) throw new Error("ONSHAPE_ACCESS_TOKEN is required");
        return new OAuthClient(accessToken, baseUrlFromEnv());
    }
}
