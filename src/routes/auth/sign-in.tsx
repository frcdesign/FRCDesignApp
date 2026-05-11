import { createFileRoute, redirect } from "@tanstack/react-router";
import { useSession } from "@tanstack/react-start/server";
import {
    OAUTH_SESSION_CONFIG,
    OAuthSessionData,
    onshapeClient
} from "./-onshape-client.server";
import { generateState } from "arctic";

export const Route = createFileRoute("/auth/sign-in")({
    server: {
        handlers: {
            GET: async ({ request }) => {
                const requestUrl = new URL(request.url);
                const redirectUrl = requestUrl.searchParams.get("redirectUrl");

                // TODO: Make sure this works with the redirectUrl param from Onshape themselves
                if (!redirectUrl) {
                    throw new Error("Failed to get valid redirectUrl!");
                }

                const state = generateState();

                const session =
                    await useSession<OAuthSessionData>(OAUTH_SESSION_CONFIG);
                await session.update({ state, redirectUrl });

                const authUrl = onshapeClient.createAuthorizationURL(
                    "https://oauth.onshape.com/oauth/authorize",
                    state,
                    []
                );

                throw redirect({ href: authUrl.toString() });
            }
        }
    },
    component: () => null
});
