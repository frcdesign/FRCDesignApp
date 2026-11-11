import {
    Accordion,
    ActionIcon,
    Anchor,
    Badge,
    Button,
    Group,
    Stack,
    Text,
    Tooltip
} from "@mantine/core";
import { ArrowSquareOutIcon } from "@phosphor-icons/react";
import { type PropsWithChildren, type ReactNode, useRef } from "react";
import {
    type DesignCheckOut,
    type DesignIssue,
    DesignIssueType,
    getDesignIssueSeverity,
    type TabCheck
} from "@backend/features/design-check/contract";
import { ElementType } from "@backend/lib/onshape/element-type";
import { PageNotice } from "../../../components/app-notice";
import { Callout } from "../../../components/callout";
import { StatusIcon } from "../../../components/status-icon";
import {
    sendOpenFeatureMessage,
    sendClearSelectionMessage,
    sendSelectPartMessage,
    sendSwitchTabMessage
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
import { getFixLabel, planFix, planFixes } from "../fixes";
import { getDesignIssueHelp, getDesignIssueName } from "../issue-text";
import { openFixDialog } from "../open-fix-dialog";

interface DesignCheckResultsProps {
    target: TargetElement;
    result: DesignCheckOut;
    /** Checking again failed, so `result` is the check before. */
    failedAgain?: boolean;
}

/** Every tab of the document, each folding open to its issues, the launch's tab open. */
export function DesignCheckResults(props: DesignCheckResultsProps): ReactNode {
    const { target, result, failedAgain } = props;
    const issues = result.tabs.flatMap((tab) => tab.issues);
    const fixes = planFixes(target, result.tabs);
    const checkedAt = m.designCheckCheckedAt({ checkedAt: result.checkedAt });
    const failedNote = failedAgain && (
        <Callout status={Status.ERROR} text={m.designCheckAgainFailed()} />
    );

    if (issues.length === 0 && result.tabs.every((tab) => !tab.failed)) {
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
                        {failedNote}
                        {m.designCheckCleanDocument()}
                        {result.tabs.some((tab) => tab.sketchStatusUnknown) && (
                            <SketchNote />
                        )}
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
            {failedNote}
            <Group justify="space-between" wrap="nowrap">
                <SeverityBadges
                    severities={issues.map((issue) =>
                        getDesignIssueSeverity(issue.type)
                    )}
                />
                <Group gap="xs" wrap="nowrap">
                    <Text size="xs" c="dimmed">
                        {checkedAt}
                    </Text>
                    {fixes.length > 0 && (
                        <Button
                            size="compact-sm"
                            variant="light"
                            onClick={() => openFixDialog(target, fixes)}
                        >
                            {m.designCheckFixAll()}
                        </Button>
                    )}
                </Group>
            </Group>
            <Accordion multiple defaultValue={[target.elementId]}>
                {result.tabs.map((tab) => (
                    <TabItem key={tab.elementId} target={target} tab={tab} />
                ))}
            </Accordion>
        </Stack>
    );
}

function SketchNote(): ReactNode {
    return (
        <Text size="sm" c="dimmed">
            {m.designCheckSketchStatusUnknown()}
        </Text>
    );
}

interface TabItemProps {
    target: TargetElement;
    tab: TabCheck;
}

/** A tab's name and counts, with a way over to it, folding open to its issues. */
function TabItem(props: TabItemProps): ReactNode {
    const { target, tab } = props;
    const isLaunchTab = tab.elementId === target.elementId;

    return (
        <Accordion.Item value={tab.elementId}>
            <Group gap={0} wrap="nowrap">
                <Accordion.Control>
                    <Group justify="space-between" wrap="nowrap" gap="xs">
                        <Stack gap={0} miw={0}>
                            <Text fw={500} truncate>
                                {tab.name}
                            </Text>
                            {isLaunchTab && (
                                <Text size="xs" c="dimmed">
                                    {m.designCheckThisTab()}
                                </Text>
                            )}
                        </Stack>
                        {tab.failed ? (
                            <Badge color="red" variant="light">
                                {m.designCheckTabNotChecked()}
                            </Badge>
                        ) : (
                            <SeverityBadges
                                severities={tab.issues.map((issue) =>
                                    getDesignIssueSeverity(issue.type)
                                )}
                            />
                        )}
                    </Group>
                </Accordion.Control>
                {!isLaunchTab && (
                    <ActionIcon
                        title={m.designCheckSwitchTab()}
                        variant="subtle"
                        mx="xs"
                        onClick={() =>
                            sendSwitchTabMessage(target, tab.elementId)
                        }
                    >
                        <ArrowSquareOutIcon size={IconSize.MEDIUM} />
                    </ActionIcon>
                )}
            </Group>
            <Accordion.Panel>
                <TabIssues target={target} tab={tab} />
            </Accordion.Panel>
        </Accordion.Item>
    );
}

interface TabIssuesProps {
    target: TargetElement;
    tab: TabCheck;
}

/** One box per kind of issue, worst first, naming everything it was found on. */
function TabIssues(props: TabIssuesProps): ReactNode {
    const { target, tab } = props;
    if (tab.failed) {
        return <Text size="sm">{m.designCheckTabFailed()}</Text>;
    }
    return (
        <Stack gap="sm">
            {tab.sketchStatusUnknown && <SketchNote />}
            {tab.issues.length === 0 ? (
                <Text size="sm" c="dimmed">
                    {m.designCheckTabClean()}
                </Text>
            ) : (
                groupByType(tab.issues).map((issues) => (
                    <IssueGroup
                        key={issues[0].type}
                        target={target}
                        tab={tab}
                        issues={issues}
                    />
                ))
            )}
        </Stack>
    );
}

/** In the order they came, which is worst first. */
function groupByType(issues: DesignIssue[]): DesignIssue[][] {
    return [...Map.groupBy(issues, (issue) => issue.type).values()];
}

interface IssueGroupProps {
    target: TargetElement;
    tab: TabCheck;
    /** Every one of the same type. */
    issues: DesignIssue[];
}

function IssueGroup(props: IssueGroupProps): ReactNode {
    const { target, tab, issues } = props;
    const first = issues[0];
    const severity = getDesignIssueSeverity(first.type);
    const named = issues.filter((issue) => issue.subject !== undefined);
    // Onshape opens and selects only in the tab the app was launched in.
    const pointAt = tab.elementId === target.elementId ? target : undefined;

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
                {first.subject === undefined && (
                    <FixButton target={target} tab={tab} issue={first} />
                )}
                {named.length > 0 && (
                    <Stack gap={2}>
                        {named.map((issue, index) => (
                            <Group
                                key={issueKey(issue, index)}
                                gap="xs"
                                wrap="nowrap"
                                justify="space-between"
                            >
                                <IssueSubject target={pointAt} issue={issue} />
                                <FixButton
                                    target={target}
                                    tab={tab}
                                    issue={issue}
                                />
                            </Group>
                        ))}
                    </Stack>
                )}
            </Stack>
        </Group>
    );
}

interface FixButtonProps {
    target: TargetElement;
    tab: TabCheck;
    issue: DesignIssue;
}

/** Asks to confirm the issue's one fix, where the app can make one. */
function FixButton(props: FixButtonProps): ReactNode {
    const { target, tab, issue } = props;
    const planned = planFix(target, tab, issue);
    if (!planned || !issue.fix) {
        return null;
    }
    return (
        <Button
            size="compact-xs"
            variant="light"
            flex="none"
            onClick={() => openFixDialog(target, [planned])}
        >
            {getFixLabel(issue.fix)}
        </Button>
    );
}

function issueKey(issue: DesignIssue, index: number): string {
    // Instances of one part share its id.
    return issue.featureId ?? issue.instanceId ?? issue.partId ?? `${index}`;
}

interface IssueSubjectProps {
    target?: TargetElement;
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
 * In the launch's tab, a feature opens in Onshape's feature dialog, and a part
 * or part instance is selected in the window; a broken instance or suppressed
 * Part Studio feature, and anything in another tab, is only named.
 */
function IssueSubject(props: IssueSubjectProps): ReactNode {
    const { target, issue } = props;
    const { featureId, partId, instanceId, subject } = issue;
    if (!target) {
        return <SubjectName>{subject}</SubjectName>;
    }
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
            <PartLink
                target={target}
                partId={partId}
                occurrencePath={instanceId ? [instanceId] : undefined}
            >
                {subject}
            </PartLink>
        );
    }
    return <SubjectName>{subject}</SubjectName>;
}

function SubjectName(props: PropsWithChildren): ReactNode {
    return (
        <Text size="sm" fw={500} truncate>
            {props.children}
        </Text>
    );
}

interface PartLinkProps extends PropsWithChildren {
    target: TargetElement;
    partId: string;
    /** The instance's, in an assembly. */
    occurrencePath?: string[];
}

/** Hovering selects the part in the window and leaving clears it; a click keeps it. */
function PartLink(props: PartLinkProps): ReactNode {
    const { target, partId, occurrencePath, children } = props;
    const isHovering = useRef(false);
    const select = () => sendSelectPartMessage(target, partId, occurrencePath);

    return (
        <SubjectLink
            tooltip={m.designCheckSelectPart()}
            onMouseEnter={() => {
                isHovering.current = true;
                select();
            }}
            onMouseLeave={() => {
                if (isHovering.current) {
                    sendClearSelectionMessage(target);
                    isHovering.current = false;
                }
            }}
            onClick={() => {
                // Kept: leaving no longer clears it.
                if (!isHovering.current) {
                    select();
                }
                isHovering.current = false;
            }}
        >
            {children}
        </SubjectLink>
    );
}

interface SubjectLinkProps extends PropsWithChildren {
    tooltip: string;
    onClick: () => void;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
}

function SubjectLink(props: SubjectLinkProps): ReactNode {
    const { tooltip, onClick, onMouseEnter, onMouseLeave, children } = props;
    return (
        <Tooltip label={tooltip} position="top-start">
            <Anchor
                component="button"
                size="sm"
                fw={500}
                ta="left"
                truncate
                onClick={onClick}
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
            >
                {children}
            </Anchor>
        </Tooltip>
    );
}
