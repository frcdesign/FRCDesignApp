import { Button, Group, Stack, Text } from "@mantine/core";
import { ArrowSquareOutIcon } from "@phosphor-icons/react";
import { type ReactNode } from "react";
import {
    workspaceKey,
    type VersionJobFailure,
    type VersionJobStatus
} from "@backend/features/version-manager/contract";
import { AppModalBody } from "../../../components/app-modal";
import { useOnshapeOrigin } from "../../../lib/onshape-params";
import {
    FontWeight,
    IconSize,
    StatusColor
} from "../../../lib/style-constants";
import { makeUrl, openUrlInNewTab } from "../../../lib/url";
import styles from "../../../lib/styles.module.css";
import { describeJob } from "../job-report";
import { plural } from "../queries";

interface FailureGroup {
    key: string;
    documentName?: string;
    failures: VersionJobFailure[];
}

/** By workspace, in the order the run reached them. */
function groupByWorkspace(failures: VersionJobFailure[]): FailureGroup[] {
    const groups = new Map<string, FailureGroup>();
    for (const failure of failures) {
        const key = workspaceKey(failure.workspace);
        const group = groups.get(key) ?? {
            key,
            documentName: failure.documentName,
            failures: []
        };
        group.failures.push(failure);
        groups.set(key, group);
    }
    return [...groups.values()];
}

interface JobDetailsProps {
    status: VersionJobStatus;
}

/**
 * What a run could not do: each tab Onshape refused, under its document, with
 * why, and a way into it — the refusal is usually fixed in the tab itself.
 */
export function JobDetails(props: JobDetailsProps): ReactNode {
    const { status } = props;
    const origin = useOnshapeOrigin();
    const failures = status.result?.failures ?? [];
    const unlisted = (status.result?.failedElements ?? 0) - failures.length;

    return (
        <AppModalBody gap="md">
            <Text>{describeJob(status)}</Text>
            {groupByWorkspace(failures).map((group) => (
                <Stack key={group.key} gap="xs">
                    <Text fw={FontWeight.SEMI_BOLD}>
                        {group.documentName ?? "A linked document"}
                    </Text>
                    {group.failures.map((failure) => (
                        <Group
                            key={failure.elementId}
                            justify="space-between"
                            wrap="nowrap"
                        >
                            <Stack gap={0} miw={0}>
                                <Text truncate>
                                    {failure.elementName ?? "Unnamed tab"}
                                </Text>
                                <Text size="xs" c={StatusColor.DIMMED}>
                                    {failure.reason}
                                </Text>
                            </Stack>
                            <Button
                                size="compact-sm"
                                variant="subtle"
                                className={styles.noShrink}
                                rightSection={
                                    <ArrowSquareOutIcon size={IconSize.SMALL} />
                                }
                                onClick={() =>
                                    openUrlInNewTab(
                                        makeUrl(origin, {
                                            ...failure.workspace,
                                            elementId: failure.elementId
                                        })
                                    )
                                }
                            >
                                Open
                            </Button>
                        </Group>
                    ))}
                </Stack>
            ))}
            {unlisted > 0 && (
                <Text size="sm" c={StatusColor.DIMMED}>
                    {plural(unlisted, "more tab")} couldn't be updated.
                </Text>
            )}
        </AppModalBody>
    );
}
