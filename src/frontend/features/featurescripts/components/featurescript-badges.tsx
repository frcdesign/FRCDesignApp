import { Badge, Group, Tooltip } from "@mantine/core";
import { type ReactNode } from "react";
import {
    type FeatureScriptOut,
    FeatureScriptProblem
} from "@backend/features/featurescripts/contract";
import { StatusColor } from "../../../lib/style-constants";
import { m } from "../../../paraglide/messages";
import { useIsOwner } from "../queries";

function problemLabel(problem: FeatureScriptProblem): string {
    switch (problem) {
        case FeatureScriptProblem.NO_EXAMPLE:
            return m.featureScriptsProblemNoExample();
        case FeatureScriptProblem.NO_ICON:
            return m.featureScriptsProblemNoIcon();
        case FeatureScriptProblem.NOT_ONE_FEATURE:
            return m.featureScriptsProblemNotOneFeature();
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
        case FeatureScriptProblem.NOT_ONE_FEATURE:
            return m.featureScriptsProblemNotOneFeatureTip();
        case FeatureScriptProblem.LOAD_FAILED:
            return m.featureScriptsProblemLoadFailedTip();
    }
}

interface FeatureScriptBadgesProps {
    feature: FeatureScriptOut;
}

/** To the owner, what's wrong with it. */
export function FeatureScriptBadges(
    props: FeatureScriptBadgesProps
): ReactNode {
    const { feature } = props;
    const isOwner = useIsOwner();
    if (!isOwner || feature.problems.length === 0) {
        return null;
    }
    return (
        <Group gap={4} wrap="nowrap">
            {feature.problems.map((problem) => (
                <Tooltip key={problem} label={problemTip(problem, feature)}>
                    <Badge variant="light" color={StatusColor.WARNING}>
                        {problemLabel(problem)}
                    </Badge>
                </Tooltip>
            ))}
        </Group>
    );
}
