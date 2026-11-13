import { Button } from "@mantine/core";
import { ListChecksIcon } from "@phosphor-icons/react";
import { type ReactNode, useEffect } from "react";
import { Hint } from "@backend/features/hints/contract";
import {
    PageError,
    PageLoading,
    PageNotice
} from "../../../components/app-notice";
import { useTargetElement } from "../../../lib/onshape-params";
import { IconSize } from "../../../lib/style-constants";
import { m } from "../../../paraglide/messages";
import { useNeedsSignIn } from "../../auth/access-level";
import { startSignIn } from "../../auth/sign-in";
import { useMarkHintSeen } from "../../hints/queries";
import { useDesignCheckQuery } from "../queries";
import { DesignCheckResults } from "./design-check-results";

/** The check of the tab the app was launched in. */
export function DesignCheckPage(): ReactNode {
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
    // A failed Check again keeps the last results, marked as such.
    if (query.isError && !query.data) {
        return <PageError title={m.designCheckFailed()} error={query.error} />;
    }
    if (!query.data) {
        return <PageLoading title={m.designCheckChecking()} />;
    }
    return (
        <DesignCheckResults
            target={target}
            result={query.data}
            failedAgain={query.isError}
        />
    );
}
