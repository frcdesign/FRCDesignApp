import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@mantine/core";
import { ScalesIcon } from "@phosphor-icons/react";
import { type ReactNode } from "react";
import { ElementType } from "@backend/lib/onshape/element-type";
import { PageNotice } from "../../components/app-notice";
import { AppIcon } from "../../components/app-icon";
import { UtilityTab } from "../../lib/app-tab";
import { updateUiState } from "../../lib/ui-state";
import { useTargetElement } from "../../lib/onshape-params";
import { IconSize, PrimaryColor } from "../../lib/style-constants";
import { useNeedsSignIn } from "../../features/auth/access-level";
import { startSignIn } from "../../features/auth/sign-in";
import { MassAnalysisPanel } from "../../features/mass-analysis/components/mass-analysis-panel";
import { m } from "../../paraglide/messages";

export const Route = createFileRoute("/app/mass-analysis")({
    component: MassAnalysisPage,
    // Where entry resumes next time, as a library would be.
    onEnter: () => {
        updateUiState({ tabId: UtilityTab.MASS_ANALYSIS });
    }
});

const PAGE_ICON = (
    <AppIcon
        icon={ScalesIcon}
        size={IconSize.PAGE}
        color={PrimaryColor.FILLED}
    />
);

function MassAnalysisPage(): ReactNode {
    const target = useTargetElement();
    const needsSignIn = useNeedsSignIn();

    if (target?.elementType !== ElementType.ASSEMBLY) {
        return (
            <PageNotice
                icon={PAGE_ICON}
                title={m.massAnalysisOpenAssemblyTitle()}
                description={m.massAnalysisOpenAssemblyDescription()}
            />
        );
    }
    if (needsSignIn) {
        return (
            <PageNotice
                icon={PAGE_ICON}
                title={m.massAnalysisSignInTitle()}
                description={m.massAnalysisSignInDescription()}
                action={
                    <Button onClick={startSignIn}>
                        {m.massAnalysisSignIn()}
                    </Button>
                }
            />
        );
    }
    return <MassAnalysisPanel assembly={target} />;
}
