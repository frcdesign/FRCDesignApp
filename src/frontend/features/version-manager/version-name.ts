/**
 * What a push calls its version when nobody typed a name — which is what
 * pushing usually is: somebody wants their change visible downstream, not a
 * named milestone.
 *
 * The local date and time, so the version list reads as a history of when
 * things were pushed. Built in the browser rather than on the server, which has
 * no idea what time it is where the caller is.
 */
export function defaultVersionName(now: Date = new Date()): string {
    return now.toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short"
    });
}
