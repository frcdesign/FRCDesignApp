import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@mantine/core";
import { ScrewdriverIcon } from "@phosphor-icons/react";
import { type ReactNode, useEffect } from "react";
import { ElementType } from "@backend/lib/onshape/element-type";
import { PageNotice } from "../../components/app-notice";
import { AppIcon } from "../../components/app-icon";
import { UtilityTab } from "../../lib/app-tab";
import { updateUiState } from "../../lib/ui-state";
import {
    useIsConnectedToOnshape,
    useTargetElement
} from "../../lib/onshape-params";
import { IconSize, PrimaryColor } from "../../lib/style-constants";
import { useNeedsSignIn } from "../../features/auth/access-level";
import { startSignIn } from "../../features/auth/sign-in";
import { AutoAssemblyPanel } from "../../features/auto-assembly/components/auto-assembly-panel";
import { m } from "../../paraglide/messages";
import { useMarkHintSeen } from "../../features/hints/queries";
import { Hint } from "@backend/features/hints/contract";

export const Route = createFileRoute("/app/auto-assembly")({
    component: AutoAssemblyPage,
    // Where entry resumes next time, as a library would be.
    onEnter: () => {
        updateUiState({ tabId: UtilityTab.AUTO_ASSEMBLY });
    }
});

const PAGE_ICON = (
    <AppIcon
        icon={ScrewdriverIcon}
        size={IconSize.PAGE}
        color={PrimaryColor.FILLED}
    />
);

function AutoAssemblyPage(): ReactNode {
    const target = useTargetElement();
    const isConnected = useIsConnectedToOnshape();
    const needsSignIn = useNeedsSignIn();
    const markOpened = useMarkHintSeen(Hint.OPENED_AUTO_ASSEMBLY);

    useEffect(markOpened, [markOpened]);

    if (target?.elementType !== ElementType.ASSEMBLY) {
        return (
            <PageNotice
                icon={PAGE_ICON}
                title={
                    isConnected
                        ? m.autoAssemblyOpenAssemblyTitle()
                        : m.autoAssemblyOnshapeOnlyTitle()
                }
                description={
                    isConnected
                        ? m.autoAssemblyOpenAssemblyDescription()
                        : m.autoAssemblyOnshapeOnlyDescription()
                }
            />
        );
    }
    if (needsSignIn) {
        return (
            <PageNotice
                icon={PAGE_ICON}
                title={m.autoAssemblySignInTitle()}
                description={m.autoAssemblySignInDescription()}
                action={
                    <Button onClick={startSignIn}>
                        {m.autoAssemblySignIn()}
                    </Button>
                }
            />
        );
    }
    return <AutoAssemblyPanel assembly={target} />;
}
