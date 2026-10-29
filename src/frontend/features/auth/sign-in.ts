import { useOnshapeLaunch } from "../../lib/onshape-params";

/** Returns to the page it was started from. */
export function startSignIn(): void {
    const query = new URLSearchParams({
        redirectUrl: window.location.pathname + window.location.search
    });
    const { sessionCompanyId } = useOnshapeLaunch.getState();
    if (sessionCompanyId) {
        query.set("sessionCompanyId", sessionCompanyId);
    }
    window.location.href = "/auth/sign-in?" + query.toString();
}
