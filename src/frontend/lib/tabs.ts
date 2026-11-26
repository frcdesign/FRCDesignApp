/** Where each tab goes, and how it is spelled. */
import { useNavigate } from "@tanstack/react-router";
import {
    GitBranchIcon,
    type Icon,
    PuzzlePieceIcon,
    ScalesIcon,
    ScrewdriverIcon
} from "@phosphor-icons/react";
import { type AppTab, getTabPath, isLibraryTab, UtilityTab } from "./app-tab";
import { getLibraryName } from "./library";
import { AppColor } from "../theme";
import { m } from "../paraglide/messages";

export function useNavigateToTab(): (tabId: AppTab) => void {
    const navigate = useNavigate();

    return (tabId) => {
        if (isLibraryTab(tabId)) {
            void navigate({
                to: "/app/library/$libraryId",
                params: { libraryId: tabId }
            });
            return;
        }
        void navigate({ href: getTabPath(tabId) });
    };
}

export function getTabName(tabId: AppTab): string {
    return isLibraryTab(tabId) ? getLibraryName(tabId) : getUtilityName(tabId);
}

export function getUtilityName(tabId: UtilityTab): string {
    switch (tabId) {
        case UtilityTab.VERSION_MANAGER:
            return "Version Manager";
        case UtilityTab.AUTO_ASSEMBLY:
            return "Auto Assembly";
        case UtilityTab.FEATURESCRIPTS:
            return m.featureScriptsTabName();
        case UtilityTab.MASS_ANALYSIS:
            return m.massAnalysisTabName();
    }
}

export function getUtilityIcon(tabId: UtilityTab): Icon {
    switch (tabId) {
        case UtilityTab.VERSION_MANAGER:
            return GitBranchIcon;
        case UtilityTab.AUTO_ASSEMBLY:
            return ScrewdriverIcon;
        case UtilityTab.FEATURESCRIPTS:
            return PuzzlePieceIcon;
        case UtilityTab.MASS_ANALYSIS:
            return ScalesIcon;
    }
}

/** The color the page themes the app in. */
export function getUtilityColor(tabId: UtilityTab): string {
    switch (tabId) {
        case UtilityTab.VERSION_MANAGER:
            return AppColor.VERSION_MANAGER;
        case UtilityTab.AUTO_ASSEMBLY:
            return AppColor.AUTO_ASSEMBLY;
        case UtilityTab.FEATURESCRIPTS:
            return AppColor.FEATURESCRIPTS;
        case UtilityTab.MASS_ANALYSIS:
            return AppColor.MASS_ANALYSIS;
    }
}
