import { Timestamp } from "@google-cloud/firestore";
import { generateState, OAuth2Client, OAuth2Tokens } from "arctic";
import { DB } from "../../connect/db";
import {
    getRequestHeader,
    getRequestUrl,
    setResponseStatus,
    useSession
} from "@tanstack/react-start/server";
import { OnshapeApi } from "../../onshape-api/client/onshape-api";
import { OAuthApi } from "../../onshape-api/client/oauth-api";
import { redirect } from "@tanstack/react-router";

export async function isAuthenticated() {
    const sessionManager = await getAppSession();
    const sessionId = sessionManager.id;

    if (!sessionId) {
        return false;
    }

    const tokens = await getTokens(sessionId);
    if (!tokens) {
        return false;
    }

    // TODO: ping Onshape or something
    return true;
}

export async function getOnshapeApi(): Promise<OnshapeApi> {
    const sessionManager = await getAppSession();
    const sessionId = sessionManager.id;

    if (!sessionId) {
        throw new Error("Failed to find valid session");
    }

    const tokens = await getTokens(sessionId);
    if (!tokens) {
        throw new Error("Failed to find valid tokens");
    }

    const refreshTokens = async () => {
        const oauthClient = getOauthClient();
        const newTokens = await oauthClient
            .refreshAccessToken(TOKEN_ENDPOINT, tokens.refreshToken, [])
            .then(makeAuthTokens);

        saveTokens(sessionId, newTokens);

        return newTokens.accessToken;
    };

    let accessToken = tokens.accessToken;
    // If the token expired in the past, refresh immediately
    if (tokens.expiresAt <= Timestamp.now()) {
        accessToken = await refreshTokens();
    }

    return new OAuthApi(accessToken);
}

function getOauthClient(): OAuth2Client {
    return new OAuth2Client(
        process.env.OAUTH_CLIENT_ID!,
        process.env.OAUTH_CLIENT_SECRET!,
        null
    );
}

const AUTH_ENDPOINT = "https://oauth.onshape.com/oauth/authorize";
const TOKEN_ENDPOINT = "https://oauth.onshape.com/oauth/token";

interface OAuthSessionData {
    state: string;
    redirectUrl: string;
}

/**
 * Stores the redirectUrl and state.
 *
 * Returns the URL the user should be redirected to.
 */
export async function doSignIn(redirectUrl: string): Promise<string> {
    const oauthClient = getOauthClient();

    const state = generateState();

    // Store the state and redirectUrl
    const sessionManager = await getAppSession();
    await sessionManager.update({ state, redirectUrl });

    return oauthClient
        .createAuthorizationURL(AUTH_ENDPOINT, state, [])
        .toString();
}

export async function doCallback(): Promise<string> {
    const search = getRequestUrl().searchParams;
    if (search.get("error") === "access_denied") {
        throw redirect({ to: "/grant-denied" });
    }

    const code = search.get("code");

    const sessionManager = await getAppSession();

    const data = sessionManager.data;
    const sessionId = sessionManager.id;
    const redirectUrl = data.redirectUrl;
    const cookieState = data.state;

    // There was a problem with the cookie used to store redirect information
    if (!redirectUrl || !cookieState) {
        if (isSafari()) {
            throw redirect({ to: "/safari-error" });
        }
        throw redirect({ to: "/cookie-error" });
    } else if (!sessionId || !code || cookieState !== search.get("state")) {
        setResponseStatus(400);
        throw new Error("Invalid response from Onshape");
    }

    const oauthClient = getOauthClient();

    await oauthClient
        .validateAuthorizationCode(TOKEN_ENDPOINT, code, null)
        .then(makeAuthTokens)
        .then((tokens) => saveTokens(sessionId, tokens));

    return redirectUrl;
}

function isSafari(): boolean {
    const userAgent = getRequestHeader("User-Agent") ?? "";
    return (
        userAgent.includes("Safari/") &&
        userAgent.includes("AppleWebKit/") &&
        !userAgent.includes("Chrome/") &&
        !userAgent.includes("CriOS/") &&
        !userAgent.includes("FxiOS/") &&
        !userAgent.includes("Edg/") &&
        !userAgent.includes("OPR/")
    );
}

async function getAppSession() {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useSession<OAuthSessionData>({
        password: process.env.SESSION_SECRET!,
        name: "oauth-state",
        maxAge: 30 * 24 * 3600, // Same amount of time as the database expiration
        cookie: {
            // SameSite=none + secure required because the app runs embedded in an Onshape iframe
            httpOnly: true,
            secure: true,
            sameSite: "none",
            path: "/"
        }
    });
}

interface AuthTokens {
    accessToken: string;
    refreshToken: string;
    expiresAt: Timestamp;
}

function makeAuthTokens(tokens: OAuth2Tokens): AuthTokens {
    return {
        accessToken: tokens.accessToken(),
        refreshToken: tokens.refreshToken(),
        expiresAt: Timestamp.fromDate(tokens.accessTokenExpiresAt())
    };
}

/**
 * Saves a set of tokens into the database.
 */
async function saveTokens(sessionId: string, tokens: AuthTokens) {
    await DB.collection("sessions").doc(sessionId).set({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        deleteAt: getDeleteAt(),
        createdAt: Timestamp.now()
    });
}

/**
 * Returns a timestamp 30 days from now.
 */
function getDeleteAt(): Timestamp {
    const date = new Date(); // A date object containing the current time
    date.setDate(date.getDate() + 30); // date = days in JavaScript
    return Timestamp.fromDate(date);
}

/**
 * Retrieves a set of tokens from the database.
 */
async function getTokens(sessionId: string): Promise<AuthTokens | null> {
    const doc = await DB.collection("sessions").doc(sessionId).get();
    if (!doc.exists) return null;

    const data = doc.data();
    if (!data) return null;

    return {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        expiresAt: data.expiresAt
    };
}
