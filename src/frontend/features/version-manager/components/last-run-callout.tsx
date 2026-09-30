import { Group } from "@mantine/core";
import { ClockIcon, ListBulletsIcon } from "@phosphor-icons/react";
import { type ReactNode } from "react";
import {
    jobOutcome,
    VersionJobState,
    type VersionJobStatus,
    type WorkspacePath
} from "@backend/features/version-manager/contract";
import { Callout, CalloutButton } from "../../../components/callout";
import { TimeAgo } from "../../../components/time-ago";
import { Status } from "../../../lib/status";
import { IconSize } from "../../../lib/style-constants";
import { jobHeadline, OUTCOME_STATUS, runningHeadline } from "../job-report";
import { openJobDetails } from "../open-version-modals";
import { useVersionJobQuery } from "../queries";

interface LastRunCalloutProps {
    workspace: WorkspacePath;
}

/**
 * The push or pull this workspace last started: what it is doing while it
 * goes, then how it went for as long as the status is kept.
 */
export function LastRunCallout(props: LastRunCalloutProps): ReactNode {
    const { workspace } = props;
    const { data: status } = useVersionJobQuery(workspace);

    const outcome = jobOutcome(status);
    const isRunning = status?.state === VersionJobState.RUNNING;
    if (!status || (!outcome && !isRunning)) {
        return null;
    }
    const calloutStatus = outcome ? OUTCOME_STATUS[outcome] : Status.INFO;

    return (
        <Callout
            text={calloutText(status)}
            status={calloutStatus}
            loading={isRunning}
            action={
                <Group gap="sm" ml="auto">
                    {outcome && (
                        <TimeAgo
                            timestamp={status.finishedAt}
                            icon={ClockIcon}
                        />
                    )}
                    <CalloutButton
                        status={calloutStatus}
                        icon={<ListBulletsIcon size={IconSize.SMALL} />}
                        onClick={() => openJobDetails(workspace)}
                    >
                        Details
                    </CalloutButton>
                </Group>
            }
        />
    );
}

function calloutText(status: VersionJobStatus): string {
    const outcome = jobOutcome(status);
    if (!outcome) {
        return `${runningHeadline(status)}...`;
    }
    return `${jobHeadline(status, outcome)}.`;
}
