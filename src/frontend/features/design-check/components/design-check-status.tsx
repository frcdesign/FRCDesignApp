import {
    Badge,
    Button,
    Group,
    ScrollArea,
    Stack,
    Text,
    UnstyledButton
} from "@mantine/core";
import { ListChecksIcon } from "@phosphor-icons/react";
import { type ReactNode } from "react";
import { BuildIssueSeverity } from "@backend/features/build-checker/issues";
import {
    type DesignCheckOut,
    getDesignIssueSeverity,
    type TabCheck
} from "@backend/features/design-check/contract";
import { AppHoverCard } from "../../../components/app-hover-card";
import { BadgedIcon } from "../../../components/badged-icon";
import { StatusIcon } from "../../../components/status-icon";
import { UtilityTab } from "../../../lib/app-tab";
import { type TargetElement } from "../../../lib/onshape-launch";
import { useTargetElement } from "../../../lib/onshape-params";
import { Status } from "../../../lib/status";
import { IconSize } from "../../../lib/style-constants";
import { useSelectTab } from "../../../lib/tabs";
import { m } from "../../../paraglide/messages";
import { SeverityBadges } from "../../build-status/components/issues";
import { useDesignCheckQuery } from "../queries";

/** The tab's severities, leaving out what someone dismissed. */
function liveSeverities(tab: TabCheck): BuildIssueSeverity[] {
    return tab.issues
        .filter((issue) => !issue.dismissed)
        .map((issue) => getDesignIssueSeverity(issue.type));
}

/**
 * The document's errors and warnings beside the library's controls, each tab's
 * on hover, opening Design Check on a click. Nothing until a check has answered.
 */
export function DesignCheckStatus(): ReactNode {
    const target = useTargetElement();
    const { data } = useDesignCheckQuery(target);
    if (!target || !data) {
        return null;
    }
    return <DesignCheckStatusCard target={target} result={data} />;
}

interface DesignCheckStatusCardProps {
    target: TargetElement;
    result: DesignCheckOut;
}

function DesignCheckStatusCard(props: DesignCheckStatusCardProps): ReactNode {
    const { target, result } = props;
    const selectTab = useSelectTab();
    const severities = result.tabs.flatMap(liveSeverities);
    const errors = severities.filter(
        (severity) => severity === BuildIssueSeverity.ERROR
    ).length;
    const warnings = severities.filter(
        (severity) => severity === BuildIssueSeverity.WARNING
    ).length;
    const status =
        errors > 0
            ? Status.ERROR
            : warnings > 0
              ? Status.WARNING
              : Status.SUCCESS;
    const openDesignCheck = () => selectTab(UtilityTab.DESIGN_CHECK);

    return (
        <AppHoverCard
            position="bottom-end"
            interactive
            target={
                <UnstyledButton
                    my="auto"
                    title={m.designCheckStatusOpen()}
                    onClick={openDesignCheck}
                >
                    <Group gap={6} wrap="nowrap">
                        <BadgedIcon icon={ListChecksIcon} status={status} />
                        {errors > 0 && (
                            <StatusCount status={Status.ERROR} count={errors} />
                        )}
                        {warnings > 0 && (
                            <StatusCount
                                status={Status.WARNING}
                                count={warnings}
                            />
                        )}
                    </Group>
                </UnstyledButton>
            }
        >
            <Stack gap="xs" maw={320}>
                <Text fw={500}>{m.designCheckTabName()}</Text>
                <ScrollArea.Autosize mah={240}>
                    <Stack gap={6}>
                        {result.tabs.map((tab) => (
                            <Group
                                key={tab.elementId}
                                justify="space-between"
                                wrap="nowrap"
                                gap="sm"
                            >
                                <Text
                                    size="sm"
                                    truncate
                                    fw={
                                        tab.elementId === target.elementId
                                            ? 500
                                            : undefined
                                    }
                                >
                                    {tab.name}
                                </Text>
                                {tab.failed ? (
                                    <Badge color="red" variant="light">
                                        {m.designCheckTabNotChecked()}
                                    </Badge>
                                ) : (
                                    <SeverityBadges
                                        severities={liveSeverities(tab)}
                                    />
                                )}
                            </Group>
                        ))}
                    </Stack>
                </ScrollArea.Autosize>
                <Group justify="space-between" wrap="nowrap">
                    <Text size="xs" c="dimmed">
                        {m.designCheckCheckedAt({
                            checkedAt: result.checkedAt
                        })}
                    </Text>
                    <Button size="compact-sm" onClick={openDesignCheck}>
                        {m.designCheckStatusOpen()}
                    </Button>
                </Group>
            </Stack>
        </AppHoverCard>
    );
}

interface StatusCountProps {
    status: Status;
    count: number;
}

function StatusCount(props: StatusCountProps): ReactNode {
    const { status, count } = props;
    return (
        <Group gap={2} wrap="nowrap">
            <StatusIcon status={status} size={IconSize.SMALL} raised={false} />
            <Text size="sm" fw={500}>
                {m.designCheckStatusCount({ count })}
            </Text>
        </Group>
    );
}
