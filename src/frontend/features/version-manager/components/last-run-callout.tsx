import { Box } from "@mantine/core";
import { ListBulletsIcon } from "@phosphor-icons/react";
import { type ReactNode } from "react";
import type { WorkspacePath } from "@backend/features/version-manager/contract";
import { AppIcon } from "../../../components/app-icon";
import { Callout, CalloutButton } from "../../../components/callout";
import { formatTimeAgo } from "../../../lib/format-time";
import { IconSize } from "../../../lib/style-constants";
import { jobHeadline, jobOutcome, OUTCOME_STYLE } from "../job-report";
import { openJobDetails } from "../open-version-modals";
import { useVersionJobQuery } from "../queries";

interface LastRunCalloutProps {
    workspace: WorkspacePath;
}

/**
 * How the last push or pull from this workspace went, for as long as the
 * status is kept. A toast reaches only whoever was looking when the run
 * finished; this is for whoever opens the page after, which for a long
 * recursive push is most people.
 */
export function LastRunCallout(props: LastRunCalloutProps): ReactNode {
    const { data: status } = useVersionJobQuery(props.workspace);

    const outcome = jobOutcome(status);
    if (!status || !outcome) {
        return null;
    }
    const { color, icon } = OUTCOME_STYLE[outcome];
    const when = status.finishedAt
        ? ` ${formatTimeAgo(status.finishedAt)}`
        : "";

    return (
        <Box p="sm">
            <Callout
                text={`${jobHeadline(status, outcome)}${when}.`}
                color={color}
                icon={<AppIcon icon={icon} size={IconSize.MEDIUM} />}
                action={
                    <CalloutButton
                        color={color}
                        icon={<ListBulletsIcon size={IconSize.SMALL} />}
                        onClick={() => openJobDetails(status)}
                    >
                        Details
                    </CalloutButton>
                }
            />
        </Box>
    );
}
