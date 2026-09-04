import { Badge, Group, Stack, Text } from "@mantine/core";
import {
    CheckIcon,
    InfoIcon,
    WarningIcon,
    WarningOctagonIcon
} from "@phosphor-icons/react";
import { ReactNode, useMemo } from "react";
import {
    addBuildIssue,
    BuildIssue,
    BuildIssueSeverity,
    BuildIssueType,
    getIssueDescription,
    getIssueSeverity,
    hasBuildIssue
} from "@backend/features/build-checker/issues";
import {
    GroupBuildStatus,
    InsertableBuildStatus
} from "@backend/features/build-checker/contract";
import {
    IconSize,
    NO_SHRINK,
    RADIUS,
    StatusColor,
    statusBackground
} from "../../../lib/style-constants";
import { AppIcon, type AppIconProps } from "../../../components/app-icon";
import { SectionHeader } from "./sections";

/**
 * Returns the build issues for an insertable, merging insertable-level and
 * configuration-level issues.
 */
export function getInsertableBuildIssues(
    insertable: InsertableBuildStatus
): BuildIssue[] {
    const configIssues = insertable.configuration?.buildIssues ?? [];
    return [...insertable.buildIssues, ...configIssues];
}

/**
 * Stored issues plus the live "no unhidden insertables" check, which needs the
 * per-insertable visibility in the same response.
 */
export function useGroupBuildIssues(
    groupStatus: GroupBuildStatus | undefined,
    insertableStatuses: Record<string, InsertableBuildStatus> | undefined
): BuildIssue[] {
    return useMemo(() => {
        if (!groupStatus) return [];
        const hasUnhidden = groupStatus.insertableOrder.some(
            (id) => insertableStatuses?.[id]?.isVisible
        );
        // A group that never loaded has no insertables to unhide, so the failure
        // is the whole story.
        if (
            hasUnhidden ||
            hasBuildIssue(groupStatus.buildIssues, BuildIssueType.LOAD_FAILED)
        ) {
            return groupStatus.buildIssues;
        }
        return addBuildIssue(groupStatus.buildIssues, {
            type: BuildIssueType.NO_UNHIDDEN_INSERTABLES
        });
    }, [groupStatus, insertableStatuses]);
}

interface IssueIconProps extends Omit<AppIconProps, "icon" | "color"> {
    /** The severity to render, or null if all checks pass. */
    severity: BuildIssueSeverity | null;
}

/** The icon each severity is drawn as; `ok` is a build with nothing to say. */
const SEVERITY_ICONS = {
    [BuildIssueSeverity.ERROR]: WarningOctagonIcon,
    [BuildIssueSeverity.WARNING]: WarningIcon,
    [BuildIssueSeverity.INFO]: InfoIcon,
    ok: CheckIcon
};

/** The color a severity is spoken in; null is a build with nothing to say. */
function severityColor(severity: BuildIssueSeverity | null): StatusColor {
    switch (severity) {
        case BuildIssueSeverity.ERROR:
            return StatusColor.ERROR;
        case BuildIssueSeverity.WARNING:
            return StatusColor.WARNING;
        case BuildIssueSeverity.INFO:
            return StatusColor.INFO;
        case null:
            return StatusColor.SUCCESS;
    }
}

/** Renders the icon for a build-issue severity in its severity color. */
export function IssueIcon({ severity, ...others }: IssueIconProps): ReactNode {
    return (
        <AppIcon
            icon={SEVERITY_ICONS[severity ?? "ok"]}
            color={severityColor(severity)}
            {...others}
        />
    );
}

interface SeverityBadgesProps {
    issues: BuildIssue[];
}

/** Pill badges summarizing the issue counts, or an "all clear" badge. */
export function SeverityBadges(props: SeverityBadgesProps): ReactNode {
    const { issues } = props;
    if (issues.length === 0) {
        return (
            <Badge
                size="sm"
                variant="light"
                color={StatusColor.SUCCESS}
                leftSection={<CheckIcon size={IconSize.TINY} />}
            >
                All checks pass
            </Badge>
        );
    }

    const counts = countSeverities(issues);
    return (
        <Group gap={6} wrap="wrap">
            {counts.error > 0 && (
                <CountBadge
                    severity={BuildIssueSeverity.ERROR}
                    count={counts.error}
                />
            )}
            {counts.warning > 0 && (
                <CountBadge
                    severity={BuildIssueSeverity.WARNING}
                    count={counts.warning}
                />
            )}
            {counts.info > 0 && (
                <CountBadge
                    severity={BuildIssueSeverity.INFO}
                    count={counts.info}
                />
            )}
        </Group>
    );
}

/** The badge color and singular noun for each severity. */
const SEVERITY_BADGE: Record<
    BuildIssueSeverity,
    { color: string; noun: string }
> = {
    [BuildIssueSeverity.ERROR]: { color: "red", noun: "error" },
    [BuildIssueSeverity.WARNING]: { color: "yellow", noun: "warning" },
    [BuildIssueSeverity.INFO]: { color: "blue", noun: "info" }
};

interface CountBadgeProps {
    severity: BuildIssueSeverity;
    count: number;
}

function CountBadge(props: CountBadgeProps): ReactNode {
    const { severity, count } = props;
    const { color, noun } = SEVERITY_BADGE[severity];
    // Don't pluralize info, e.g. "2 infos" reads wrong.
    const plural = severity !== BuildIssueSeverity.INFO && count > 1 ? "s" : "";
    return (
        <Badge size="sm" variant="light" color={color}>
            {`${count} ${noun}${plural}`}
        </Badge>
    );
}

/** How many issues of each severity a build carries. */
interface SeverityCounts {
    error: number;
    warning: number;
    info: number;
}

function countSeverities(issues: BuildIssue[]): SeverityCounts {
    const counts = { error: 0, warning: 0, info: 0 };
    for (const issue of issues) {
        switch (getIssueSeverity(issue)) {
            case BuildIssueSeverity.ERROR:
                counts.error += 1;
                break;
            case BuildIssueSeverity.WARNING:
                counts.warning += 1;
                break;
            case BuildIssueSeverity.INFO:
                counts.info += 1;
                break;
        }
    }
    return counts;
}

interface BuildChecksSectionProps {
    issues: BuildIssue[];
}

/** The build checks: one tinted callout per issue. Rendered only when non-empty. */
export function BuildChecksSection(props: BuildChecksSectionProps): ReactNode {
    const { issues } = props;
    return (
        <Stack gap={6}>
            <SectionHeader>Build checks</SectionHeader>
            {issues.map((issue) => (
                <IssueCallout key={issue.type} issue={issue} />
            ))}
        </Stack>
    );
}

interface IssueCalloutProps {
    issue: BuildIssue;
}

/** A single build issue rendered as a tinted callout box in its severity color. */
function IssueCallout(props: IssueCalloutProps): ReactNode {
    const { issue } = props;
    const severity = getIssueSeverity(issue);
    return (
        <Group
            gap="xs"
            wrap="nowrap"
            align="flex-start"
            p="xs"
            style={{
                backgroundColor: severityBackground(severity),
                borderRadius: RADIUS
            }}
        >
            {/* Nudge the icon down so it aligns with the first line of text. */}
            <IssueIcon
                severity={severity}
                style={{ ...NO_SHRINK, marginTop: 2 }}
            />
            <Text size="sm">{getIssueDescription(issue)}</Text>
        </Group>
    );
}

/** The light background tint for a build-issue callout. */
function severityBackground(severity: BuildIssueSeverity): string {
    return statusBackground(severityColor(severity));
}
