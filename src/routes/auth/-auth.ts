import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import { getSession, SESSION_COOKIE } from "./-onshape-client.server";

export const getAuthSession = createServerFn().handler(async () => {
    const sessionId = getCookie(SESSION_COOKIE);
    if (!sessionId) return null;
    return getSession(sessionId);
});
