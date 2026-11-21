/** Separate so the component file exports only components, which React Refresh needs. */
import { UsersThreeIcon } from "@phosphor-icons/react";
import { openAppModal } from "../../components/open-app-modal";
import { AppModalBody } from "../../components/app-modal";
import { AppTitle } from "../../components/app-title";
import { IconSize } from "../../lib/style-constants";
import { m } from "../../paraglide/messages";
import { TeamPanelContent } from "./components/team-panel";

export function openTeamPanel(): void {
    openAppModal({
        title: (
            <AppTitle
                title={m.teamPanelTitle()}
                icon={<UsersThreeIcon size={IconSize.MEDIUM} />}
            />
        ),
        children: (
            <AppModalBody>
                <TeamPanelContent />
            </AppModalBody>
        )
    });
}
