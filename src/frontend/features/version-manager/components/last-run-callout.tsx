import { ListBulletsIcon } from "@phosphor-icons/react";
import { type ReactNode } from "react";
import {
    VersionJobState,
    type WorkspacePath
} from "@backend/features/version-manager/contract";
import { Callout, CalloutButton } from "../../../components/callout";
import { formatTimeAgo } from "../../../lib/format-time";
import { IconSize, StatusColor } from "../../../lib/style-constants";
import {
    jobHeadline,
    jobOutcome,
    OUTCOME_STYLE,
    runningHeadline
} from "../job-report";
import { openJobDetails } from "../open-version-modals";
import { useVersionJobQuery } from "../queries";

interface LastRunCalloutProps {
    workspace: WorkspacePath;
}

/**
 * The push or pull this workspace last started: what it is doing while it
 * goes, then how it went for as long as the status is kept. A toast reaches
 * only whoever was looking when the run finished; this is for whoever opens
 * the page after, which for a long recursive push is most people.
 */
export function LastRunCallout(props: LastRunCalloutProps): ReactNode {
    const { workspace } = props;
    const { data: status } = useVersionJobQuery(workspace);

    if (!status) {
        return null;
    }
    const details = (color: StatusColor) => (
        <CalloutButton
            color={color}
            icon={<ListBulletsIcon size={IconSize.SMALL} />}
            onClick={() => openJobDetails(workspace)}
        >
            Details
        </CalloutButton>
    );

    if (status.state === VersionJobState.RUNNING) {
        return (
            <Callout
                text={`${runningHeadline(status)}...`}
                loading
                action={details(StatusColor.INFO)}
            />
        );
    }

    const outcome = jobOutcome(status);
    if (!outcome) {
        return null;
    }
    const { color, icon } = OUTCOME_STYLE[outcome];
    const when = status.finishedAt
        ? ` ${formatTimeAgo(status.finishedAt)}`
        : "";
    return (
        <Callout
            text={`${jobHeadline(status, outcome)}${when}.`}
            color={color}
            icon={icon}
            action={details(color)}
        />
    );
}
