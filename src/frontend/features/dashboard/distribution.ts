import type { HistogramBin } from "@backend/features/analytics/histogram";
import { formatCount } from "./format";
import { m } from "../../paraglide/messages";

/** "0", "2–4" for counts of whole things; "2–5" for rates, whose upper edge is open. */
export function binLabel(bin: HistogramBin, integer: boolean): string {
    if (integer) {
        return bin.to - bin.from === 1
            ? formatCount(bin.from)
            : m.dashboardBinRange({ from: bin.from, to: bin.to - 1 });
    }
    return m.dashboardBinRange({ from: bin.from, to: bin.to });
}
