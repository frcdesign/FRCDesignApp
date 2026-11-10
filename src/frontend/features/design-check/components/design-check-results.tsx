import { Anchor, Group, Stack, Text, Tooltip } from "@mantine/core";
import { type ReactNode } from "react";
import {
    type DesignCheckOut,
    type DesignIssue,
    DesignIssueType,
    getDesignIssueSeverity
} from "@backend/features/design-check/contract";
import { ElementType } from "@backend/lib/onshape/element-type";
import { PageNotice } from "../../../components/app-notice";
import { StatusIcon } from "../../../components/status-icon";
import {
    sendOpenFeatureMessage,
    sendSelectPartMessage
} from "../../../lib/messages";
import { type TargetElement } from "../../../lib/onshape-launch";
import { Status, statusWash } from "../../../lib/status";
import { IconSize } from "../../../lib/style-constants";
import { m } from "../../../paraglide/messages";
import {
    IssueIcon,
    SeverityBadges
} from "../../build-status/components/issues";
import { severityStatus } from "../../build-status/severity-status";
import { getDesignIssueHelp, getDesignIssueName } from "../issue-text";

interface DesignCheckResultsProps {
    target: TargetElement;
    result: DesignCheckOut;
}

/** One box per kind of issue, worst first, naming everything it was found on. */
export function DesignCheckResults(props: DesignCheckResultsProps): ReactNode {
    const { target, result } = props;
    const groups = groupByType(result.issues);
    const checkedAt = m.designCheckCheckedAt({ checkedAt: result.checkedAt });
    const sketchNote = result.sketchStatusUnknown && (
        <Text size="sm" c="dimmed">
            {m.designCheckSketchStatusUnknown()}
        </Text>
    );

    if (groups.length === 0) {
        return (
            <PageNotice
                icon={
                    <StatusIcon
                        status={Status.SUCCESS}
                        size={IconSize.PAGE}
                        raised={false}
                    />
                }
                title={m.designCheckCleanTitle()}
                description={
                    <Stack gap="xs">
                        {getCleanDescription(result.elementType)}
                        {sketchNote}
                        <Text size="xs" c="dimmed">
                            {checkedAt}
                        </Text>
                    </Stack>
                }
            />
        );
    }

    return (
        <Stack gap="sm" p="sm">
            <Group justify="space-between" wrap="nowrap">
                <SeverityBadges
                    severities={result.issues.map((issue) =>
                        getDesignIssueSeverity(issue.type)
                    )}
                />
                <Text size="xs" c="dimmed">
                    {checkedAt}
                </Text>
            </Group>
            {sketchNote}
            {groups.map((issues) => (
                <IssueGroup
                    key={issues[0].type}
                    target={target}
                    issues={issues}
                />
            ))}
        </Stack>
    );
}

function getCleanDescription(elementType: ElementType): string {
    switch (elementType) {
        case ElementType.PART_STUDIO:
            return m.designCheckCleanPartStudio();
        case ElementType.ASSEMBLY:
            return m.designCheckCleanAssembly();
    }
}

/** In the order they came, which is worst first. */
function groupByType(issues: DesignIssue[]): DesignIssue[][] {
    return [...Map.groupBy(issues, (issue) => issue.type).values()];
}

interface IssueGroupProps {
    target: TargetElement;
    /** Every one of the same type. */
    issues: DesignIssue[];
}

function IssueGroup(props: IssueGroupProps): ReactNode {
    const { target, issues } = props;
    const first = issues[0];
    const severity = getDesignIssueSeverity(first.type);
    const named = issues.filter((issue) => issue.subject !== undefined);

    return (
        <Group
            gap="xs"
            wrap="nowrap"
            align="flex-start"
            p="xs"
            bdrs="sm"
            bg={statusWash(severityStatus(severity))}
        >
            <IssueIcon severity={severity} size={IconSize.SMALL} />
            <Stack gap={4} flex={1} miw={0}>
                <Text fw={500}>{getDesignIssueName(first.type)}</Text>
                <Text size="sm">{getDesignIssueHelp(first)}</Text>
                {named.length > 0 && (
                    <Stack gap={2}>
                        {named.map((issue, index) => (
                            <IssueSubject
                                key={issueKey(issue, index)}
                                target={target}
                                issue={issue}
                            />
                        ))}
                    </Stack>
                )}
            </Stack>
        </Group>
    );
}

function issueKey(issue: DesignIssue, index: number): string {
    // Instances of one part share its id.
    return issue.featureId ?? issue.instanceId ?? issue.partId ?? `${index}`;
}

interface IssueSubjectProps {
    target: TargetElement;
    issue: DesignIssue;
}

/** What Onshape won't open in a Part Studio, from here or from its own list. */
const SUPPRESSED = new Set([
    DesignIssueType.FEATURE_SUPPRESSED,
    DesignIssueType.ORIGIN_CUBE_SUPPRESSED
]);

function opensInOnshape(target: TargetElement, issue: DesignIssue): boolean {
    return (
        target.elementType === ElementType.ASSEMBLY ||
        !SUPPRESSED.has(issue.type)
    );
}

/**
 * A feature opens in Onshape's feature dialog, and a part or part instance is
 * selected in the window; a broken instance or suppressed Part Studio feature
 * is only named.
 */
function IssueSubject(props: IssueSubjectProps): ReactNode {
    const { target, issue } = props;
    const { featureId, partId, instanceId, subject } = issue;
    if (featureId && opensInOnshape(target, issue)) {
        return (
            <SubjectLink
                tooltip={m.designCheckOpenFeature()}
                onClick={() => sendOpenFeatureMessage(target, featureId)}
            >
                {subject}
            </SubjectLink>
        );
    }
    if (partId) {
        return (
            <SubjectLink
                tooltip={m.designCheckSelectPart()}
                onClick={() =>
                    sendSelectPartMessage(
                        target,
                        partId,
                        instanceId ? [instanceId] : undefined
                    )
                }
            >
                {subject}
            </SubjectLink>
        );
    }
    return (
        <Text size="sm" fw={500} truncate>
            {subject}
        </Text>
    );
}

interface SubjectLinkProps {
    tooltip: string;
    onClick: () => void;
    children: ReactNode;
}

function SubjectLink(props: SubjectLinkProps): ReactNode {
    const { tooltip, onClick, children } = props;
    return (
        <Tooltip label={tooltip} position="top-start">
            <Anchor
                component="button"
                size="sm"
                fw={500}
                ta="left"
                truncate
                onClick={onClick}
            >
                {children}
            </Anchor>
        </Tooltip>
    );
}
