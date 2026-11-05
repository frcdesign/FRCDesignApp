import { useOnshapeLaunch } from "../../lib/onshape-params";

/** Returns to the page it was started from. */
export function startSignIn(): void {
    const query = new URLSearchParams({
        redirectUrl: window.location.pathname + window.location.search
    });
    const { companyId } = useOnshapeLaunch.getState();
    if (companyId) {
        query.set("companyId", companyId);
    }
    window.location.href = "/auth/sign-in?" + query.toString();
}
