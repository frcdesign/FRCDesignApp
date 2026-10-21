import { createFileRoute, redirect } from "@tanstack/react-router";
import { Button } from "@mantine/core";
import { ScrewdriverIcon } from "@phosphor-icons/react";
import { type ReactNode } from "react";
import { ElementType } from "@backend/lib/onshape/element-type";
import { PageLoading, PageNotice } from "../../components/app-notice";
import { AppIcon } from "../../components/app-icon";
import { UtilityTab } from "../../lib/app-tab";
import { updateUiState } from "../../lib/ui-state";
import { getUiLibraryId } from "../../lib/library";
import { toTargetElement } from "../../lib/onshape-launch";
import { useOnshapeLaunch, useTargetElement } from "../../lib/onshape-params";
import { IconSize, PrimaryColor } from "../../lib/style-constants";
import { useNeedsSignIn } from "../../features/auth/access-level";
import { startSignIn } from "../../features/auth/sign-in";
import { QuickFastenerPanel } from "../../features/quick-fastener/components/quick-fastener-panel";

export const Route = createFileRoute("/app/quick-fastener")({
    component: QuickFastenerPage,
    // Where entry resumes next time, as a library would be.
    onEnter: () => {
        updateUiState({ tabId: UtilityTab.QUICK_FASTENER });
    },
    beforeLoad: () => {
        // The page picker hides this page outside a tab, so this only catches
        // a url typed or restored by hand.
        if (!toTargetElement(useOnshapeLaunch.getState())) {
            throw redirect({
                to: "/app/library/$libraryId",
                params: { libraryId: getUiLibraryId() },
                replace: true
            });
        }
    }
});

const PAGE_ICON = (
    <AppIcon
        icon={ScrewdriverIcon}
        size={IconSize.PAGE}
        color={PrimaryColor.FILLED}
    />
);

function QuickFastenerPage(): ReactNode {
    const target = useTargetElement();
    const needsSignIn = useNeedsSignIn();

    if (!target) {
        // What renders on the way out, `beforeLoad` having redirected.
        return <PageLoading title="Loading..." />;
    }
    if (target.elementType !== ElementType.ASSEMBLY) {
        return (
            <PageNotice
                icon={PAGE_ICON}
                title="Open an assembly to fasten parts"
                description="Quick Fastener puts screws, washers and nuts in the holes of an assembly's parts. Open it from an assembly's panel."
            />
        );
    }
    if (needsSignIn) {
        return (
            <PageNotice
                icon={PAGE_ICON}
                title="Sign in to fasten parts"
                description="Quick Fastener reads your assembly's holes and inserts fasteners into it."
                action={<Button onClick={startSignIn}>Sign in</Button>}
            />
        );
    }
    return <QuickFastenerPanel assembly={target} />;
}
