import { AppFeature } from "@backend/features/analytics/usage";
import { m } from "../../paraglide/messages";

export enum NudgeKind {
    /** The blue dot on something not yet opened; see `features/hints`. */
    DOT = "dot",
    /** A tip toast; see `showTipToast`. */
    TIP = "tip",
    /** Something on the feature's own page suggesting a use of it. */
    SUGGESTION = "suggestion",
    /** A card on the splash screen everybody sees once at launch. */
    SPLASH_SCREEN = "splash-screen"
}

/** Which one, where its kind alone doesn't say: a marker is labelled by it in place of its kind. */
export enum NudgeName {
    SUGGESTED_LINKS = "suggested-links"
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

/**
 * Every nudge toward a feature shipped or withdrawn; add one in the change that
 * ships it. A tip making one part of a feature faster doesn't send anybody to
 * the feature, so it isn't one.
 */
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
    // Shown since before tracking began; withdrawn with the row's button.
    {
        feature: AppFeature.QUICK_INSERT,
        kind: NudgeKind.TIP,
        change: NudgeChange.REMOVED,
        day: "2026-11-14"
    },
    {
        feature: AppFeature.AUTO_ASSEMBLY,
        kind: NudgeKind.DOT,
        change: NudgeChange.ADDED,
        day: "2026-11-22"
    },
    // An insert and fasten with nothing picked, until somebody has fastened to picks.
    {
        feature: AppFeature.PRESELECTION,
        kind: NudgeKind.TIP,
        change: NudgeChange.ADDED,
        day: "2026-11-22"
    },
    // A card on the splash screen, shown once to everybody on their next launch.
    {
        feature: AppFeature.FEATURESCRIPTS,
        kind: NudgeKind.SPLASH_SCREEN,
        change: NudgeChange.ADDED,
        day: "2026-11-26"
    },
    {
        feature: AppFeature.VERSION_MANAGER,
        kind: NudgeKind.SPLASH_SCREEN,
        change: NudgeChange.ADDED,
        day: "2026-11-26"
    },
    {
        feature: AppFeature.AUTO_ASSEMBLY,
        kind: NudgeKind.SPLASH_SCREEN,
        change: NudgeChange.ADDED,
        day: "2026-11-26"
    }
];

/** A new way to reach a feature, which labels its marker; a release without one created the feature. */
export enum ReleaseName {
    BUTTON = "button",
    PRESELECTION = "preselection",
    CONTEXT_MENU = "context-menu"
}

/** A feature, or a way to reach it, reaching production. */
export interface Release {
    feature: AppFeature;
    name?: ReleaseName;
    /** The day production first served it, in the reporting day's time zone. */
    day: string;
}

/**
 * Every release since tracking began, dated by production's deploys; add one
 * in the change that ships it. A feature older than tracking has none.
 */
export const RELEASES: readonly Release[] = [
    { feature: AppFeature.INSERT_LOCATION, day: "2026-09-17" },
    { feature: AppFeature.VERSION_MANAGER, day: "2026-10-29" },
    { feature: AppFeature.DEFAULT_CONFIGURATION, day: "2026-10-29" },
    { feature: AppFeature.RECENTS, day: "2026-11-06" },
    { feature: AppFeature.REPORT, day: "2026-11-06" },
    { feature: AppFeature.DOWNLOAD, day: "2026-11-07" },
    // Inside Onshape, where the footer inserts instead.
    {
        feature: AppFeature.DOWNLOAD,
        name: ReleaseName.CONTEXT_MENU,
        day: "2026-11-13"
    },
    // Each row's Insert or Derive button, in place of the menus' Quick insert.
    {
        feature: AppFeature.QUICK_INSERT,
        name: ReleaseName.BUTTON,
        day: "2026-11-14"
    },
    { feature: AppFeature.FEATURESCRIPTS, day: "2026-11-14" },
    { feature: AppFeature.AUTO_ASSEMBLY, day: "2026-11-22" },
    { feature: AppFeature.PRESELECTION, day: "2026-11-22" },
    {
        feature: AppFeature.FASTEN,
        name: ReleaseName.PRESELECTION,
        day: "2026-11-22"
    }
];

export function releaseLabel(release: Release): string {
    if (release.name === undefined) return m.dashboardReleaseCreated();
    switch (release.name) {
        case ReleaseName.BUTTON:
            return m.dashboardReleaseButton();
        case ReleaseName.PRESELECTION:
            return m.dashboardReleasePreselection();
        case ReleaseName.CONTEXT_MENU:
            return m.dashboardReleaseContextMenu();
    }
}

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
        case NudgeKind.SPLASH_SCREEN:
            return added
                ? m.dashboardNudgeSplashScreenAdded()
                : m.dashboardNudgeSplashScreenRemoved();
    }
}

function nameLabel(name: NudgeName): string {
    switch (name) {
        case NudgeName.SUGGESTED_LINKS:
            return m.dashboardNudgeSuggestedLinks();
    }
}
