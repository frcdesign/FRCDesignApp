import { kvStore } from "../../lib/kv-store";
import { runInBackground } from "../../lib/background";
import type { AppContext } from "../../lib/context";
import { Hint } from "./contract";

/** Per user, so a hint dismissed on one computer stays dismissed on the next. */
const seenHints = kvStore<Hint[]>("seen-hints");

export async function getSeenHints(
    kv: KVNamespace,
    userId: string
): Promise<Hint[]> {
    return (await seenHints.get(kv, userId)) ?? [];
}

/**
 * Records a hint as seen, after the response: a side effect of the request that
 * used the feature. Read before written, so a repeat costs no write; two marks
 * racing can drop one, which only shows a dot again.
 */
export function markHintSeen(c: AppContext, hint: Hint): Promise<void> {
    return runInBackground(c, "record a seen hint", async () => {
        const userId = await c.var.getUserId();
        const seen = await getSeenHints(c.env.KV, userId);
        if (!seen.includes(hint)) {
            await seenHints.put(c.env.KV, userId, [...seen, hint]);
        }
    });
}
