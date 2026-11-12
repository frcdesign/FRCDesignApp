import { Stack, Text } from "@mantine/core";
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
import { Status } from "../../../lib/status";
import { IconSize, StatusColor } from "../../../lib/style-constants";
import { m } from "../../../paraglide/messages";
import { SwitchRow } from "../../build-status/components/sections";
import { useIsOwner, useSetVisibilityMutation } from "../queries";
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

interface FeatureScriptStatusProps {
    feature: FeatureScriptOut;
}

/**
 * The owner's card about a feature, modeled on a part's admin card: whether
 * users see it, the release loaded, and what its load found. Nothing for
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
                {feature.problems.map((problem) => (
                    <HoverBubbleRow
                        key={problem}
                        label={problemLabel(problem)}
                        description={problemTip(problem, feature)}
                    >
                        <StatusIcon
                            status={problemStatus(problem)}
                            size={IconSize.SMALL}
                        />
                    </HoverBubbleRow>
                ))}
            </Stack>
        </AppHoverBubble>
    );
}
