import { Anchor, Badge, Group, Stack, Text } from "@mantine/core";
import {
    ArrowSquareOutIcon,
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
    getIssueConfigurationKey,
    getIssueDescription,
    getIssueSeverity,
    hasBuildIssue
} from "@backend/features/build-checker/issues";
import { ConfigurationParameter } from "@backend/features/configurations/contract";
import { fromKey } from "@backend/features/configurations/selection";
import { ElementPath } from "@backend/lib/onshape/path";
import { makeUrl } from "../../../lib/url";
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

/**
 * What a configuration issue opens: the tab it belongs to, and the parameters
 * its key is spelled against. An element with no configurations has none.
 */
export interface ConfigurationTarget {
    elementPath: ElementPath;
    parameters: ConfigurationParameter[];
}

/** The offending configuration in Onshape, for an issue that blames one. */
function getIssueUrl(
    issue: BuildIssue,
    target: ConfigurationTarget | undefined
): string | undefined {
    const key = getIssueConfigurationKey(issue);
    if (key === undefined || !target) {
        return undefined;
    }
    return makeUrl({
        ...target.elementPath,
        selection: fromKey(key, target.parameters)
    });
}

interface BuildChecksSectionProps {
    issues: BuildIssue[];
    /** Passed for an insertable; a group has no configurations to open. */
    configurationTarget?: ConfigurationTarget;
}

/** The build checks: one tinted callout per issue. Rendered only when non-empty. */
export function BuildChecksSection(props: BuildChecksSectionProps): ReactNode {
    const { issues, configurationTarget } = props;
    return (
        <Stack gap={6}>
            <SectionHeader>Build checks</SectionHeader>
            {issues.map((issue) => (
                <IssueCallout
                    key={issue.type}
                    issue={issue}
                    url={getIssueUrl(issue, configurationTarget)}
                />
            ))}
        </Stack>
    );
}

/** Shared by both callouts, so the linked one is laid out like the plain one. */
const CALLOUT_LAYOUT = {
    gap: "xs",
    wrap: "nowrap",
    align: "flex-start",
    p: "xs"
} as const;

/** Nudged down so the icon aligns with the first line of text. */
const CALLOUT_ICON = { ...NO_SHRINK, marginTop: 2 };

interface IssueCalloutProps {
    issue: BuildIssue;
    /** Where the issue opens, when it blames one configuration. */
    url?: string;
}

/**
 * A single build issue rendered as a tinted callout box in its severity color.
 * An issue that names a configuration is the link to it, whole box included —
 * there is nothing else in the callout to click.
 */
function IssueCallout(props: IssueCalloutProps): ReactNode {
    const { issue, url } = props;
    const severity = getIssueSeverity(issue);
    const background = {
        backgroundColor: severityBackground(severity),
        borderRadius: RADIUS
    };

    if (!url) {
        return (
            <Group {...CALLOUT_LAYOUT} style={background}>
                <IssueIcon severity={severity} style={CALLOUT_ICON} />
                <Text size="sm">{getIssueDescription(issue)}</Text>
            </Group>
        );
    }

    return (
        // The box is the link, so the anchor drops its own color and rule and
        // lets the callout keep the severity's.
        <Anchor
            href={url}
            target="_blank"
            rel="noreferrer"
            display="block"
            underline="never"
            c="inherit"
            aria-label={`${getIssueDescription(issue)} — open the configuration in Onshape`}
        >
            <Group {...CALLOUT_LAYOUT} style={background}>
                <IssueIcon severity={severity} style={CALLOUT_ICON} />
                <Text size="sm" flex={1}>
                    {getIssueDescription(issue)}
                </Text>
                <AppIcon icon={ArrowSquareOutIcon} style={CALLOUT_ICON} />
            </Group>
        </Anchor>
    );
}

/** The light background tint for a build-issue callout. */
function severityBackground(severity: BuildIssueSeverity): string {
    return statusBackground(severityColor(severity));
}
