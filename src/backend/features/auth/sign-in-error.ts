/** Where the callback sends a sign-in that didn't finish. A leaf, so the page can read it. */
import * as z from "zod";

export const SIGN_IN_ERROR_PATH = "/sign-in-error";

/** Ours, for a callback Onshape sent without an `error` of its own. */
export enum CallbackProblem {
    MISSING_CODE = "missing_code",
    STATE_MISMATCH = "state_mismatch"
}

/** Long enough for Onshape's `error_description`, short enough for a url. */
const MAX_DESCRIPTION = 300;

const clipped = (max: number) =>
    z
        .string()
        .transform((value) => value.slice(0, max))
        .optional()
        .catch(undefined);

export const SignInErrorSearch = z.object({
    /** Onshape's `error`, or a {@link CallbackProblem}. */
    error: clipped(100),
    /** Onshape's `error_description`. */
    description: clipped(MAX_DESCRIPTION),
    /** Where the sign-in was going, so signing in again lands there. */
    redirectUrl: clipped(1000)
});

export type SignInErrorSearch = z.input<typeof SignInErrorSearch>;

export function signInErrorUrl(search: SignInErrorSearch): string {
    const parsed = SignInErrorSearch.parse(search);
    const query = new URLSearchParams(
        Object.entries(parsed).filter(
            (entry): entry is [string, string] => entry[1] !== undefined
        )
    );
    return `${SIGN_IN_ERROR_PATH}?${query.toString()}`;
}
