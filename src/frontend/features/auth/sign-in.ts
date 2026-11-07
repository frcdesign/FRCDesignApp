import { useOnshapeLaunch } from "../../lib/onshape-params";

/** Returns to the page it was started from. */
export function startSignIn(): void {
    const query = new URLSearchParams({
        redirectUrl: window.location.pathname + window.location.search
    });
    // Sign-in decides from these whether it can name the company.
    const { companyId, server } = useOnshapeLaunch.getState();
    if (companyId) query.set("companyId", companyId);
    if (server) query.set("server", server);
    window.location.href = "/auth/sign-in?" + query.toString();
}
