import { Box, Text } from "@mantine/core";
import { type ReactNode } from "react";
import type { WorkspacePath } from "@backend/features/version-manager/contract";
import { AppIcon } from "../../../components/app-icon";
import { AppSection } from "../../../components/app-section";
import { AppTitle } from "../../../components/app-title";
import { formatTimeAgo } from "../../../lib/format-time";
import { IconSize, StatusColor } from "../../../lib/style-constants";
import { updateUiState } from "../../../lib/ui-state";
import { jobHeadline, jobOutcome, OUTCOME_STYLE } from "../job-report";
import { useVersionJobQuery } from "../queries";
import { JobDetails } from "./job-details";

/** The section's value among the page's {@link AppSection}s. */
export const LAST_RUN_SECTION = "last-run";

interface LastRunSectionProps {
    workspace: WorkspacePath;
    opened: boolean;
}

/**
 * How the last push or pull from this workspace went, for as long as the
 * status is kept. Collapsed it is the one-line outcome; open, the details.
 * A toast reaches only whoever was looking when the run finished; this is for
 * whoever opens the page after, which for a long recursive push is most people.
 */
export function LastRunSection(props: LastRunSectionProps): ReactNode {
    const { workspace, opened } = props;
    const { data: status } = useVersionJobQuery(workspace);

    const outcome = jobOutcome(status);
    if (!status || !outcome) {
        return null;
    }
    const { color, icon } = OUTCOME_STYLE[outcome];
    const headline = jobHeadline(status, outcome);

    return (
        <AppSection
            value={LAST_RUN_SECTION}
            name={headline}
            title={
                <AppTitle
                    title={headline}
                    rightSection={
                        status.finishedAt && (
                            <Text size="sm" c={StatusColor.DIMMED}>
                                {formatTimeAgo(status.finishedAt)}
                            </Text>
                        )
                    }
                />
            }
            icon={
                <AppIcon
                    icon={icon}
                    size={IconSize.MEDIUM}
                    color={color}
                    weight="fill"
                />
            }
            opened={opened}
            onToggle={() => updateUiState({ isLastRunOpen: !opened })}
        >
            <Box p="sm">
                <JobDetails status={status} />
            </Box>
        </AppSection>
    );
}
