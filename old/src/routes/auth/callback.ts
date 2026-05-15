import { createFileRoute, redirect } from "@tanstack/react-router";
import { doCallback } from "./-auth.server";

export const Route = createFileRoute("/auth/callback")({
    server: {
        handlers: {
            GET: async () => {
                const redirectUrl = await doCallback();
                throw redirect({ href: redirectUrl });
            }
        }
    }
});
