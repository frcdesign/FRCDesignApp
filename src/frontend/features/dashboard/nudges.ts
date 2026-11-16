import { AppFeature } from "@backend/features/analytics/usage";
import { m } from "../../paraglide/messages";

export enum NudgeKind {
    /** The blue dot on something not yet opened; see `features/hints`. */
    DOT = "dot",
    /** A tip toast; see `showTipToast`. */
    TIP = "tip"
}

export enum NudgeChange {
    ADDED = "added",
    REMOVED = "removed"
}

/** Something the app does to point a person at a feature, and when it changed. */
export interface Nudge {
    feature: AppFeature;
    kind: NudgeKind;
    change: NudgeChange;
    /** The day it reached `main`, which deploys to production. */
    day: string;
}

/** Every nudge shipped or withdrawn; add one in the change that ships it. */
export const NUDGES: readonly Nudge[] = [
    {
        feature: AppFeature.VERSION_MANAGER,
        kind: NudgeKind.DOT,
        change: NudgeChange.ADDED,
        day: "2026-10-29"
    },
    {
        feature: AppFeature.INSERT_LOCATION,
        kind: NudgeKind.DOT,
        change: NudgeChange.ADDED,
        day: "2026-10-29"
    },
    {
        feature: AppFeature.DEFAULT_CONFIGURATION,
        kind: NudgeKind.DOT,
        change: NudgeChange.ADDED,
        day: "2026-10-29"
    },
    {
        feature: AppFeature.REPORT,
        kind: NudgeKind.DOT,
        change: NudgeChange.ADDED,
        day: "2026-11-06"
    },
    // Quick recursive push and pull, after a recursive run from the form.
    {
        feature: AppFeature.VERSION_MANAGER,
        kind: NudgeKind.TIP,
        change: NudgeChange.ADDED,
        day: "2026-11-14"
    },
    // Shown since before tracking began, so only its removal is marked.
    {
        feature: AppFeature.QUICK_INSERT,
        kind: NudgeKind.TIP,
        change: NudgeChange.REMOVED,
        day: "2026-11-14"
    }
];

export function nudgeLabel(nudge: Nudge): string {
    const added = nudge.change === NudgeChange.ADDED;
    switch (nudge.kind) {
        case NudgeKind.DOT:
            return added
                ? m.dashboardNudgeDotAdded()
                : m.dashboardNudgeDotRemoved();
        case NudgeKind.TIP:
            return added
                ? m.dashboardNudgeTipAdded()
                : m.dashboardNudgeTipRemoved();
    }
}
