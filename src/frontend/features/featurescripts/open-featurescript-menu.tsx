import { type FeatureScriptOut } from "@backend/features/featurescripts/contract";
import { MenuTitle } from "../../components/app-title";
import { openAppModal } from "../../components/open-app-modal";
import { IconSize } from "../../lib/style-constants";
import { FeatureScriptIcon } from "./components/featurescript-icon";
import { FeatureScriptMenu } from "./components/featurescript-menu";

/** Sized as the insert menu is, which it stands in for. */
export function openFeatureScriptMenu(feature: FeatureScriptOut): void {
    openAppModal({
        title: (
            <MenuTitle
                name={feature.name}
                icon={
                    <FeatureScriptIcon
                        iconUrl={feature.iconUrl}
                        size={IconSize.MEDIUM}
                    />
                }
            />
        ),
        size: 500,
        children: <FeatureScriptMenu feature={feature} />
    });
}
