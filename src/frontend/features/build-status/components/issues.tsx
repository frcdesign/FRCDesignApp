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
    getIssueConfiguration,
    getIssueDescription,
    getIssueSeverity,
    hasBuildIssue
} from "@backend/features/build-checker/issues";
import { ConfigurationParameter } from "@backend/features/configurations/contract";
import { toSelection } from "@backend/features/configurations/selection";
import { ElementPath } from "@backend/lib/onshape/path";
import { makeUrl } from "../../../lib/url";
import {
    GroupBuildStatus,
    InsertableBuildStatus
} from "@backend/features/build-checker/contract";
import { IconSize, StatusColor } from "../../../lib/style-constants";
import { AppIcon, type AppIconProps } from "../../../components/app-icon";
import { SectionHeader } from "./sections";
import { useOnshapeOrigin } from "../../../lib/onshape-params";
import styles from "../../../lib/styles.module.css";

/** Adds the live "no unhidden insertables" check, which needs visibility. */
export function useGroupBuildIssues(
    groupStatus: GroupBuildStatus | undefined,
    insertableStatuses: Record<string, InsertableBuildStatus> | undefined
): BuildIssue[] {
    return useMemo(() => {
        if (!groupStatus) return [];
        const hasUnhidden = groupStatus.insertableOrder.some(
            (id) => insertableStatuses?.[id]?.isVisible
        );
        // A group that never loaded has nothing to unhide.
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
    /** The severity to render; absent when every check passes. */
    severity?: BuildIssueSeverity;
}

/** The icon each severity is drawn as; `ok` is a build with nothing to say. */
const SEVERITY_ICONS = {
    [BuildIssueSeverity.ERROR]: WarningOctagonIcon,
    [BuildIssueSeverity.WARNING]: WarningIcon,
    [BuildIssueSeverity.INFO]: InfoIcon,
    ok: CheckIcon
};

/** The color a severity is spoken in; none is a build with nothing to say. */
function severityColor(severity?: BuildIssueSeverity): StatusColor {
    switch (severity) {
        case BuildIssueSeverity.ERROR:
            return StatusColor.ERROR;
        case BuildIssueSeverity.WARNING:
            return StatusColor.WARNING;
        case BuildIssueSeverity.INFO:
            return StatusColor.INFO;
        case undefined:
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

/** Undefined for an element with no configurations. */
export interface ConfigurationTarget {
    elementPath: ElementPath;
    parameters: ConfigurationParameter[];
}

/** The offending configuration in Onshape, for an issue that blames one. */
function getIssueUrl(
    origin: string,
    issue: BuildIssue,
    target: ConfigurationTarget | undefined
): string | undefined {
    const values = getIssueConfiguration(issue);
    if (values === undefined || !target) {
        return undefined;
    }
    return makeUrl(
        origin,
        target.elementPath,
        toSelection(values, target.parameters)
    );
}

interface BuildChecksSectionProps {
    issues: BuildIssue[];
    /** Passed for an insertable; a group has no configurations to open. */
    configurationTarget?: ConfigurationTarget;
}

/** The build checks: one tinted callout per issue. Rendered only when non-empty. */
export function BuildChecksSection(props: BuildChecksSectionProps): ReactNode {
    const { issues, configurationTarget } = props;
    const origin = useOnshapeOrigin();
    return (
        <Stack gap={6}>
            <SectionHeader>Build checks</SectionHeader>
            {issues.map((issue) => (
                <IssueCallout
                    key={issue.type}
                    issue={issue}
                    url={getIssueUrl(origin, issue, configurationTarget)}
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

interface IssueCalloutProps {
    issue: BuildIssue;
    /** Where the issue opens, when it blames one configuration. */
    url?: string;
}

/** When the issue names a configuration, the whole box links to it. */
function IssueCallout(props: IssueCalloutProps): ReactNode {
    const { issue, url } = props;
    const severity = getIssueSeverity(issue);
    const background = severityBackground(severity);

    if (!url) {
        return (
            <Group {...CALLOUT_LAYOUT} bg={background} bdrs="sm">
                <CalloutIcon severity={severity} />
                <Text size="sm">{getIssueDescription(issue)}</Text>
            </Group>
        );
    }

    return (
        <Anchor
            href={url}
            target="_blank"
            rel="noreferrer"
            display="block"
            underline="never"
            c="inherit"
            aria-label={`${getIssueDescription(issue)} — open the configuration in Onshape`}
        >
            <Group {...CALLOUT_LAYOUT} bg={background} bdrs="sm">
                <CalloutIcon severity={severity} />
                <Text size="sm" flex={1}>
                    {getIssueDescription(issue)}
                </Text>
                <AppIcon
                    icon={ArrowSquareOutIcon}
                    className={styles.noShrink}
                    style={CALLOUT_ICON_NUDGE}
                />
            </Group>
        </Anchor>
    );
}

/** The light background tint for a build-issue callout. */
function severityBackground(severity: BuildIssueSeverity): string {
    return `var(--mantine-color-${severityColor(severity)}-light)`;
}

interface CalloutIconProps {
    severity: BuildIssueSeverity;
}

/** Down to the first line of text, which a centred icon sits above. */
const CALLOUT_ICON_NUDGE = { marginTop: 2 };

function CalloutIcon(props: CalloutIconProps): ReactNode {
    return (
        <IssueIcon
            severity={props.severity}
            className={styles.noShrink}
            style={CALLOUT_ICON_NUDGE}
        />
    );
}
