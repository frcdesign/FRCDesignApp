import {
    Badge,
    Button,
    EmptyState,
    Group,
    Paper,
    Stack,
    Text
} from "@mantine/core";
import {
    ArrowSquareOutIcon,
    FileIcon,
    WarningCircleIcon,
    XCircleIcon
} from "@phosphor-icons/react";
import { type ReactNode } from "react";
import {
    workspaceKey,
    type VersionJobFailure,
    type VersionJobStatus
} from "@backend/features/version-manager/contract";
import { AppIcon } from "../../../components/app-icon";
import { useOnshapeOrigin } from "../../../lib/onshape-params";
import {
    FontWeight,
    IconSize,
    StatusColor
} from "../../../lib/style-constants";
import { makeUrl, openUrlInNewTab } from "../../../lib/url";
import styles from "../../../lib/styles.module.css";
import { jobStats } from "../job-report";
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
 * What a run did and could not do: its counts, why it stopped if it did, and
 * each tab Onshape refused under its document, with a way into it — the
 * refusal is usually fixed in the tab itself.
 */
export function JobDetails(props: JobDetailsProps): ReactNode {
    const { status } = props;
    const failures = status.result?.failures ?? [];
    const stats = status.result ? jobStats(status.result) : [];
    const unlisted = (status.result?.failedElements ?? 0) - failures.length;

    return (
        <Stack gap="md">
            {status.error && (
                <EmptyState
                    align="left"
                    size="sm"
                    icon={
                        <AppIcon
                            icon={WarningCircleIcon}
                            size={IconSize.CONTROL}
                            color={StatusColor.ERROR}
                        />
                    }
                    title="Stopped early"
                    description={status.error}
                />
            )}
            {stats.length > 0 ? (
                <Group gap="xs">
                    {stats.map((stat) => (
                        <Badge key={stat.label} color={stat.color}>
                            {stat.label}
                        </Badge>
                    ))}
                </Group>
            ) : (
                !status.error && (
                    <Text size="sm" c={StatusColor.DIMMED}>
                        Everything was already up to date.
                    </Text>
                )
            )}
            {groupByWorkspace(failures).map((group) => (
                <FailureCard key={group.key} group={group} />
            ))}
            {unlisted > 0 && (
                <Text size="sm" c={StatusColor.DIMMED}>
                    {plural(unlisted, "more tab")} couldn't be updated.
                </Text>
            )}
        </Stack>
    );
}

interface FailureCardProps {
    group: FailureGroup;
}

/** One document's refused tabs. */
function FailureCard(props: FailureCardProps): ReactNode {
    const { group } = props;
    const origin = useOnshapeOrigin();

    return (
        <Paper withBorder radius="md">
            <Group
                gap="xs"
                px="sm"
                py="xs"
                wrap="nowrap"
                className={styles.dividerBottom}
            >
                <AppIcon icon={FileIcon} size={IconSize.MEDIUM} />
                <Text fw={FontWeight.SEMI_BOLD} truncate miw={0}>
                    {group.documentName ?? "A linked document"}
                </Text>
                <Badge
                    color={StatusColor.ERROR}
                    ml="auto"
                    className={styles.noShrink}
                >
                    {plural(group.failures.length, "tab")} failed
                </Badge>
            </Group>
            {group.failures.map((failure) => (
                <Group
                    key={failure.elementId}
                    gap="xs"
                    px="sm"
                    py="xs"
                    wrap="nowrap"
                    align="flex-start"
                >
                    <AppIcon
                        icon={XCircleIcon}
                        size={IconSize.MEDIUM}
                        color={StatusColor.ERROR}
                        className={styles.noShrink}
                    />
                    <Stack gap={0} miw={0} flex={1}>
                        <Text size="sm" truncate>
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
        </Paper>
    );
}
