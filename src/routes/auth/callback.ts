import { createFileRoute, redirect } from "@tanstack/react-router";
import { useSession, setCookie } from "@tanstack/react-start/server";
import {
    onshapeClient,
    createSession,
    OAUTH_SESSION_CONFIG,
    SESSION_COOKIE,
    COOKIE_BASE,
    type OAuthSessionData
} from "./-auth.server";

export const Route = createFileRoute("/auth/callback")({
    server: {
        handlers: {
            GET: async ({ request }) => {
                const url = new URL(request.url);
                const code = url.searchParams.get("code");
                const state = url.searchParams.get("state");

                const session =
                    await useSession<OAuthSessionData>(OAUTH_SESSION_CONFIG);
                const { state: storedState, redirectUrl } = session.data;

                if (!code || !state || !storedState || state !== storedState) {
                    return new Response("Invalid OAuth state", { status: 400 });
                }

                await session.clear();

                const tokens = await onshapeClient.validateAuthorizationCode(
                    "https://oauth.onshape.com/oauth/token",
                    code,
                    null
                );

                const sessionId = await createSession(tokens);
                setCookie(SESSION_COOKIE, sessionId, {
                    ...COOKIE_BASE,
                    maxAge: 60 * 60 * 24 * 30
                });

                throw redirect({ href: redirectUrl });
            }
        }
    }
});
