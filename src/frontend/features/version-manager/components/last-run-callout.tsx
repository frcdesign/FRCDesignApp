import { Box } from "@mantine/core";
import {
    CheckCircleIcon,
    ListBulletsIcon,
    WarningIcon,
    XCircleIcon
} from "@phosphor-icons/react";
import { type ReactNode } from "react";
import type { WorkspacePath } from "@backend/features/version-manager/contract";
import { Callout, CalloutButton } from "../../../components/callout";
import { formatTimeAgo } from "../../../lib/format-time";
import { IconSize, StatusColor } from "../../../lib/style-constants";
import { updateUiState, useUiState } from "../../../lib/ui-state";
import {
    describeJob,
    JobOutcome,
    jobKindLabel,
    jobOutcome
} from "../job-report";
import { openJobDetails } from "../open-version-modals";
import { useVersionJobQuery } from "../queries";

const OUTCOME_STYLE = {
    [JobOutcome.SUCCESS]: {
        color: StatusColor.SUCCESS,
        icon: <CheckCircleIcon size={IconSize.MEDIUM} />
    },
    [JobOutcome.PARTIAL]: {
        color: StatusColor.WARNING,
        icon: <WarningIcon size={IconSize.MEDIUM} />
    },
    [JobOutcome.FAILED]: {
        color: StatusColor.ERROR,
        icon: <XCircleIcon size={IconSize.MEDIUM} />
    }
} as const;

interface LastRunCalloutProps {
    workspace: WorkspacePath;
}

/**
 * How the last push or pull from this workspace went, until somebody closes
 * it. A toast reaches only whoever was looking when the run finished; this is
 * for whoever opens the page after, which for a long recursive push is most
 * people.
 */
export function LastRunCallout(props: LastRunCalloutProps): ReactNode {
    const { data: status } = useVersionJobQuery(props.workspace);
    const dismissedJobId = useUiState((state) => state.dismissedVersionJobId);

    const outcome = jobOutcome(status);
    if (!status || !outcome || status.jobId === dismissedJobId) {
        return null;
    }
    const { color, icon } = OUTCOME_STYLE[outcome];
    const when = status.finishedAt
        ? `, ${formatTimeAgo(status.finishedAt)}`
        : "";

    return (
        <Box p="sm">
            <Callout
                title={`Last ${jobKindLabel(status.kind)}${when}`}
                text={describeJob(status)}
                color={color}
                icon={icon}
                action={
                    (status.result?.failures.length ?? 0) > 0 && (
                        <CalloutButton
                            color={color}
                            icon={<ListBulletsIcon size={IconSize.SMALL} />}
                            onClick={() => openJobDetails(status)}
                        >
                            Details
                        </CalloutButton>
                    )
                }
                onClose={() =>
                    updateUiState({ dismissedVersionJobId: status.jobId })
                }
            />
        </Box>
    );
}
