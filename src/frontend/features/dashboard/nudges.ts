import { AppFeature } from "@backend/features/analytics/usage";
import { m } from "../../paraglide/messages";

export enum NudgeKind {
    /** The blue dot on something not yet opened; see `features/hints`. */
    DOT = "dot",
    /** A tip toast; see `showTipToast`. */
    TIP = "tip",
    /** Something on the feature's own page suggesting a use of it. */
    SUGGESTION = "suggestion"
}

/** Which one, where its kind alone doesn't say: a marker is labelled by it in place of its kind. */
export enum NudgeName {
    SUGGESTED_LINKS = "suggested-links",
    QUICK_RECURSIVE_TIP = "quick-recursive-tip"
}

export enum NudgeChange {
    ADDED = "added",
    REMOVED = "removed"
}

/** Something the app does to point a person at a feature, and when it changed. */
export interface Nudge {
    feature: AppFeature;
    kind: NudgeKind;
    name?: NudgeName;
    change: NudgeChange;
    /** The day it reached `main`, which deploys to production; absent until then, and unmarked. */
    day?: string;
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
    // Parents to link, in the parents' list and on the welcome page.
    {
        feature: AppFeature.VERSION_MANAGER,
        kind: NudgeKind.SUGGESTION,
        name: NudgeName.SUGGESTED_LINKS,
        change: NudgeChange.ADDED,
        day: "2026-11-07"
    },
    // Quick recursive push and pull, after a recursive run from the form.
    {
        feature: AppFeature.VERSION_MANAGER,
        kind: NudgeKind.TIP,
        name: NudgeName.QUICK_RECURSIVE_TIP,
        change: NudgeChange.ADDED,
        day: "2026-11-14"
    },
    // Shown since before tracking began, so only its removal is marked.
    {
        feature: AppFeature.QUICK_INSERT,
        kind: NudgeKind.TIP,
        change: NudgeChange.REMOVED,
        day: "2026-11-14"
    },
    // On cert: give each its day when it reaches main.
    {
        feature: AppFeature.AUTO_ASSEMBLY,
        kind: NudgeKind.DOT,
        change: NudgeChange.ADDED
    },
    // An insert and fasten with nothing picked, until somebody has fastened to picks.
    {
        feature: AppFeature.PRESELECTION,
        kind: NudgeKind.TIP,
        change: NudgeChange.ADDED
    },
    {
        feature: AppFeature.VERSION_MANAGER,
        kind: NudgeKind.DOT,
        change: NudgeChange.REMOVED
    }
];

export function nudgeLabel(nudge: Nudge): string {
    const added = nudge.change === NudgeChange.ADDED;
    if (nudge.name !== undefined) {
        const name = nameLabel(nudge.name);
        return added ? name : m.dashboardNudgeRemoved({ name });
    }
    switch (nudge.kind) {
        case NudgeKind.DOT:
            return added
                ? m.dashboardNudgeDotAdded()
                : m.dashboardNudgeDotRemoved();
        case NudgeKind.TIP:
            return added
                ? m.dashboardNudgeTipAdded()
                : m.dashboardNudgeTipRemoved();
        case NudgeKind.SUGGESTION:
            return added
                ? m.dashboardNudgeSuggestionAdded()
                : m.dashboardNudgeSuggestionRemoved();
    }
}

function nameLabel(name: NudgeName): string {
    switch (name) {
        case NudgeName.SUGGESTED_LINKS:
            return m.dashboardNudgeSuggestedLinks();
        case NudgeName.QUICK_RECURSIVE_TIP:
            return m.dashboardNudgeQuickRecursiveTip();
    }
}
