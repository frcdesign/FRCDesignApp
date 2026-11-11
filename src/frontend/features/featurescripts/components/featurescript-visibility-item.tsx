import { Menu } from "@mantine/core";
import { EyeIcon, EyeSlashIcon } from "@phosphor-icons/react";
import { type ReactNode } from "react";
import { type FeatureScriptOut } from "@backend/features/featurescripts/contract";
import { m } from "../../../paraglide/messages";
import { useSetVisibilityMutation } from "../queries";

interface FeatureScriptVisibilityItemProps {
    feature: FeatureScriptOut;
}

/** The owner's: hiding keeps everyone's favorites, so showing it again loses nothing. */
export function FeatureScriptVisibilityItem(
    props: FeatureScriptVisibilityItemProps
): ReactNode {
    const { feature } = props;
    const setVisibility = useSetVisibilityMutation(feature);
    return (
        <Menu.Item
            leftSection={feature.isVisible ? <EyeSlashIcon /> : <EyeIcon />}
            onClick={() => setVisibility.mutate(!feature.isVisible)}
        >
            {feature.isVisible
                ? m.featureScriptsHide()
                : m.featureScriptsShow()}
        </Menu.Item>
    );
}
