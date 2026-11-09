import { ListBulletsIcon } from "@phosphor-icons/react";
import { type ReactNode } from "react";
import {
    assemblyJobOutcome,
    AssemblyJobState,
    type AssemblyJobStatus
} from "@backend/features/auto-assembly/contract";
import { type ElementPath } from "@backend/lib/onshape/path";
import { Callout, CalloutButton } from "../../../components/callout";
import { formatTimeAgo } from "../../../lib/format-time";
import { Status } from "../../../lib/status";
import { IconSize } from "../../../lib/style-constants";
import { jobHeadline, OUTCOME_STATUS, runningHeadline } from "../job-report";
import { openJobDetails } from "../open-job-details";
import { useAssemblyJobQuery } from "../queries";
import { m } from "../../../paraglide/messages";

interface LastRunCalloutProps {
    assembly: ElementPath;
}

/**
 * The run this assembly last started: the step it is on while it goes, then
 * how it went for as long as the status is kept.
 */
export function LastRunCallout(props: LastRunCalloutProps): ReactNode {
    const { assembly } = props;
    const { data: status } = useAssemblyJobQuery(assembly);

    const outcome = assemblyJobOutcome(status);
    const isRunning = status?.state === AssemblyJobState.RUNNING;
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
                <CalloutButton
                    status={calloutStatus}
                    icon={<ListBulletsIcon size={IconSize.SMALL} />}
                    onClick={() => openJobDetails(assembly)}
                >
                    {m.autoAssemblyDetails()}
                </CalloutButton>
            }
        />
    );
}

function calloutText(status: AssemblyJobStatus): string {
    const outcome = assemblyJobOutcome(status);
    if (!outcome) {
        return m.autoAssemblyRunningCallout({ step: runningHeadline(status) });
    }
    const headline = jobHeadline(status, outcome);
    return status.finishedAt
        ? m.autoAssemblyFinishedCallout({
              headline,
              timeAgo: formatTimeAgo(status.finishedAt)
          })
        : m.autoAssemblyFinishedToast({ headline });
}
