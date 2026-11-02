import { kvStore } from "../../lib/kv-store";

/** Enough for someone working through a list of broken parts; few enough to bound a flood. */
export const REPORT_LIMIT = 10;
const WINDOW_SECONDS = 60 * 60;

/** When each recent report was sent, per reporter. KV lags, so two at once can both pass. */
const recentReports = kvStore<number[]>("feedback-sent", {
    ttlSeconds: WINDOW_SECONDS
});

/** A signed-in reporter by their user id; anyone else by their address. */
export function reporterKey(userId: string | undefined, ip: string): string {
    return userId ? `user:${userId}` : `ip:${ip}`;
}

/** Records the report and answers whether it is within the limit. */
export async function takeReportSlot(
    kv: KVNamespace,
    reporter: string,
    now = Date.now()
): Promise<boolean> {
    const since = now - WINDOW_SECONDS * 1000;
    const recent = ((await recentReports.get(kv, reporter)) ?? []).filter(
        (sentAt) => sentAt > since
    );
    if (recent.length >= REPORT_LIMIT) {
        return false;
    }
    await recentReports.put(kv, reporter, [...recent, now]);
    return true;
}
