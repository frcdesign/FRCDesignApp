import { createFileRoute, redirect } from "@tanstack/react-router";
import { Button } from "@mantine/core";
import { ListChecksIcon } from "@phosphor-icons/react";
import { type ReactNode, useEffect } from "react";
import { Hint } from "@backend/features/hints/contract";
import {
    PageError,
    PageLoading,
    PageNotice
} from "../../components/app-notice";
import { UtilityTab } from "../../lib/app-tab";
import { getUiLibraryId } from "../../lib/library";
import { toTargetElement } from "../../lib/onshape-launch";
import { useOnshapeLaunch, useTargetElement } from "../../lib/onshape-params";
import { IconSize } from "../../lib/style-constants";
import { updateUiState } from "../../lib/ui-state";
import { useNeedsSignIn } from "../../features/auth/access-level";
import { startSignIn } from "../../features/auth/sign-in";
import { DesignCheckResults } from "../../features/design-check/components/design-check-results";
import { useDesignCheckQuery } from "../../features/design-check/queries";
import { useMarkHintSeen } from "../../features/hints/queries";
import { m } from "../../paraglide/messages";

export const Route = createFileRoute("/app/design-check")({
    component: DesignCheckPage,
    // Where entry resumes next time, as a library would be.
    onEnter: () => {
        updateUiState({ tabId: UtilityTab.DESIGN_CHECK });
    },
    beforeLoad: () => {
        // The page picker hides this page without a tab to check, so this only
        // catches a url typed or restored by hand.
        if (!toTargetElement(useOnshapeLaunch.getState())) {
            throw redirect({
                to: "/app/library/$libraryId",
                params: { libraryId: getUiLibraryId() },
                replace: true
            });
        }
    }
});

function DesignCheckPage(): ReactNode {
    const target = useTargetElement();
    const needsSignIn = useNeedsSignIn();
    const query = useDesignCheckQuery(target);
    const markOpened = useMarkHintSeen(Hint.OPENED_DESIGN_CHECK);

    useEffect(markOpened, [markOpened]);

    if (!target) {
        // What renders on the way out, `beforeLoad` having redirected.
        return <PageLoading title={m.designCheckChecking()} />;
    }
    if (needsSignIn) {
        return (
            <PageNotice
                icon={<ListChecksIcon size={IconSize.SECTION} />}
                title={m.designCheckSignInTitle()}
                description={m.designCheckSignInDescription()}
                action={
                    <Button onClick={startSignIn}>
                        {m.designCheckSignIn()}
                    </Button>
                }
            />
        );
    }
    if (query.isError) {
        return <PageError title={m.designCheckFailed()} error={query.error} />;
    }
    if (!query.data) {
        return <PageLoading title={m.designCheckChecking()} />;
    }
    return <DesignCheckResults target={target} result={query.data} />;
}
