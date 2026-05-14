import { createServerFn } from "@tanstack/react-start";
import { isAuthenticated } from "./-auth.server";

export const checkAuth = createServerFn().handler(async () => {
    return await isAuthenticated();
});
