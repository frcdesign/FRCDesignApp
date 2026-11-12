import { Group, SimpleGrid, Stack, Text } from "@mantine/core";
import { EyeSlashIcon } from "@phosphor-icons/react";
import { type ReactNode } from "react";
import {
    type FeatureScriptOut,
    FeatureScriptProblem
} from "@backend/features/featurescripts/contract";
import {
    AppHoverBubble,
    HoverBubbleRow
} from "../../../components/app-hover-bubble";
import { AppIcon } from "../../../components/app-icon";
import { StatusIcon } from "../../../components/status-icon";
import { Status, statusWash } from "../../../lib/status";
import { SectionId } from "../../../lib/ui-state";
import { InfoTooltip } from "../../../components/info-tooltip";
import {
    CardSection,
    CardSections
} from "../../build-status/components/card-section";
import { Stat } from "../../build-status/components/usage-section";
import { IconSize, StatusColor } from "../../../lib/style-constants";
import { m } from "../../../paraglide/messages";
import { SwitchRow } from "../../build-status/components/sections";
import {
    useFeatureScriptStatsQuery,
    useIsOwner,
    useSetVisibilityMutation
} from "../queries";
import { FeatureScriptIcon } from "./featurescript-icon";

function problemLabel(problem: FeatureScriptProblem): string {
    switch (problem) {
        case FeatureScriptProblem.NO_EXAMPLE:
            return m.featureScriptsProblemNoExample();
        case FeatureScriptProblem.NO_ICON:
            return m.featureScriptsProblemNoIcon();
        case FeatureScriptProblem.LOAD_FAILED:
            return m.featureScriptsProblemLoadFailed();
    }
}

function problemTip(
    problem: FeatureScriptProblem,
    feature: FeatureScriptOut
): string {
    switch (problem) {
        case FeatureScriptProblem.NO_EXAMPLE:
            return m.featureScriptsProblemNoExampleTip({ name: feature.name });
        case FeatureScriptProblem.NO_ICON:
            return m.featureScriptsProblemNoIconTip({ name: feature.name });
        case FeatureScriptProblem.LOAD_FAILED:
            return m.featureScriptsProblemLoadFailedTip();
    }
}

function problemStatus(problem: FeatureScriptProblem): Status {
    return problem === FeatureScriptProblem.LOAD_FAILED
        ? Status.ERROR
        : Status.WARNING;
}

/** The worst of its problems; a hidden one shows that it is hidden first, as a part's card does. */
function StatusTarget(props: { feature: FeatureScriptOut; size: IconSize }) {
    const { feature, size } = props;
    if (!feature.isVisible) {
        return (
            <AppIcon
                icon={EyeSlashIcon}
                size={size}
                color={StatusColor.WARNING}
            />
        );
    }
    const statuses = feature.problems.map(problemStatus);
    const status = statuses.includes(Status.ERROR)
        ? Status.ERROR
        : statuses.includes(Status.WARNING)
          ? Status.WARNING
          : Status.SUCCESS;
    return <StatusIcon status={status} size={size} raised={false} />;
}

interface ProblemCalloutProps {
    problem: FeatureScriptProblem;
    feature: FeatureScriptOut;
}

/** As a part's build issue is drawn: a tinted box, its icon, its title, and why on hover. */
function ProblemCallout(props: ProblemCalloutProps): ReactNode {
    const { problem, feature } = props;
    const status = problemStatus(problem);
    return (
        <Group
            gap="xs"
            wrap="nowrap"
            align="flex-start"
            p="xs"
            bg={statusWash(status)}
            bdrs="sm"
        >
            <StatusIcon status={status} raised={false} />
            <Text flex={1}>{problemLabel(problem)}</Text>
            <InfoTooltip label={problemTip(problem, feature)} />
        </Group>
    );
}

interface UsageStatsProps {
    featureId: string;
}

/** Mounted only while Usage is open, so the stats are fetched only then. */
function UsageStats(props: UsageStatsProps): ReactNode {
    const stats = useFeatureScriptStatsQuery();
    // Absent from a loaded answer means nobody has added or favorited it yet.
    const feature =
        stats.data &&
        (stats.data[props.featureId] ?? { adds: 0, users: 0, favorites: 0 });
    return (
        <SimpleGrid cols={3} spacing="xs">
            <Stat label={m.featureScriptsAdds()} value={feature?.adds} />
            <Stat label={m.featureScriptsUsers()} value={feature?.users} />
            <Stat
                label={m.featureScriptsFavoritesCount()}
                value={feature?.favorites}
            />
        </SimpleGrid>
    );
}

interface FeatureScriptStatusProps {
    feature: FeatureScriptOut;
}

/**
 * The owner's card about a feature, a part's admin card in shape: its build
 * checks, its settings and its usage, in the same sections. Nothing for
 * anyone else.
 */
export function FeatureScriptStatus(
    props: FeatureScriptStatusProps
): ReactNode {
    const { feature } = props;
    const isOwner = useIsOwner();
    const setVisibility = useSetVisibilityMutation(feature);
    if (!isOwner) {
        return null;
    }
    const sections = [
        feature.problems.length > 0 && (
            <CardSection
                key="build-checks"
                id={SectionId.BUILD_CHECKS}
                title={m.featureScriptsBuildChecks()}
            >
                <Stack gap={6}>
                    {feature.problems.map((problem) => (
                        <ProblemCallout
                            key={problem}
                            problem={problem}
                            feature={feature}
                        />
                    ))}
                </Stack>
            </CardSection>
        ),
        <CardSection
            key="settings"
            id={SectionId.SETTINGS}
            title={m.featureScriptsSettings()}
        >
            <Stack gap="sm">
                <SwitchRow
                    label={m.featureScriptsVisibleToUsers()}
                    checked={feature.isVisible}
                    disabled={setVisibility.isPending}
                    onToggle={() => setVisibility.mutate(!feature.isVisible)}
                />
                <HoverBubbleRow label={m.featureScriptsVersionLabel()}>
                    <Text c={StatusColor.DIMMED}>
                        {feature.releaseVersion
                            ? m.featureScriptsVersionValue({
                                  version: feature.releaseVersion
                              })
                            : m.featureScriptsVersionUnknown()}
                    </Text>
                </HoverBubbleRow>
            </Stack>
        </CardSection>,
        <CardSection
            key="usage"
            id={SectionId.USAGE}
            title={m.featureScriptsUsage()}
        >
            <UsageStats featureId={feature.id} />
        </CardSection>
    ].filter((section) => section !== false);

    return (
        <AppHoverBubble
            interactive
            target={<StatusTarget feature={feature} size={IconSize.SMALL} />}
            header={{
                icon: (
                    <FeatureScriptIcon
                        iconUrl={feature.iconUrl}
                        size={IconSize.CONTROL}
                    />
                ),
                title: feature.name
            }}
        >
            <CardSections sections={sections} />
        </AppHoverBubble>
    );
}
