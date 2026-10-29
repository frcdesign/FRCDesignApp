const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const RELATIVE = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });

/** Largest first; the first one the elapsed time reaches is the one used. */
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
    ["day", DAY_MS],
    ["hour", HOUR_MS],
    ["minute", MINUTE_MS]
];

/** Anything older reads better as a date than as a count of days. */
const MAX_RELATIVE_DAYS = 7;

type Age =
    | { kind: "now" }
    | { kind: "relative"; count: number; unit: Intl.RelativeTimeFormatUnit }
    | { kind: "date" };

function toAge(timestamp: number): Age {
    const elapsed = Math.max(0, Date.now() - timestamp);
    if (elapsed >= MAX_RELATIVE_DAYS * DAY_MS) {
        return { kind: "date" };
    }
    for (const [unit, unitMs] of UNITS) {
        const count = Math.floor(elapsed / unitMs);
        if (count >= 1) {
            return { kind: "relative", count, unit };
        }
    }
    return { kind: "now" };
}

/** The year only where it isn't this one, when `short`. */
function formatDate(timestamp: number, short = false): string {
    const date = new Date(timestamp);
    const thisYear = date.getFullYear() === new Date().getFullYear();
    return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        ...(short && thisYear ? {} : { year: "numeric" })
    });
}

/** "just now", "5 minutes ago", "yesterday", "3 days ago", then a date. */
export function formatTimeAgo(timestamp: number): string {
    const age = toAge(timestamp);
    switch (age.kind) {
        case "now":
            return "just now";
        case "relative":
            return RELATIVE.format(-age.count, age.unit);
        case "date":
            return formatDate(timestamp);
    }
}

/**
 * "Just now", "5m ago", "3h ago", "2d ago", then "Sep 23": for a label with
 * little room. Spelled here rather than by Intl's narrow style, which older
 * browsers render as "5 min. ago".
 */
export function formatShortTimeAgo(timestamp: number): string {
    const age = toAge(timestamp);
    switch (age.kind) {
        case "now":
            return "Just now";
        case "relative":
            return `${age.count}${age.unit.charAt(0)} ago`;
        case "date":
            return formatDate(timestamp, true);
    }
}
