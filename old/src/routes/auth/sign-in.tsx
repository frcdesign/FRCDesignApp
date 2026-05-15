import { createFileRoute, redirect } from "@tanstack/react-router";
import { doSignIn } from "./-auth.server";
import { getRequestUrl, setResponseStatus } from "@tanstack/react-start/server";

export const Route = createFileRoute("/auth/sign-in")({
    server: {
        handlers: {
            GET: async () => {
                console.log("/auth/sign-in");
                const search = getRequestUrl().searchParams;

                // If Onshape hits this endpoint from, e.g., the user sign in page, they will populate redirectOnshapeUri with that page
                let redirectUrl = search.get("redirectOnshapeUri");
                if (redirectUrl === null) {
                    // Otherwise we should have one passed in
                    redirectUrl = search.get("redirectUrl");
                }

                if (!redirectUrl) {
                    setResponseStatus(400);
                    throw new Error("Failed to get a valid redirectUrl");
                }

                const authorizationUrl = await doSignIn(redirectUrl);
                return redirect({ href: authorizationUrl });
            }
        }
    },
    component: () => null
});
