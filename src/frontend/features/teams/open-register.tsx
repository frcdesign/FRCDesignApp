/** Separate so the component file exports only components, which React Refresh needs. */
import { UsersThreeIcon } from "@phosphor-icons/react";
import type {
    DocumentOrganization,
    MyTeam
} from "@backend/features/teams/contract";
import { openAppModal } from "../../components/open-app-modal";
import { AppTitle } from "../../components/app-title";
import { IconSize } from "../../lib/style-constants";
import { m } from "../../paraglide/messages";
import { RegisterTeamForm } from "./components/register-team-form";

export function openRegisterTeam(
    documentId: string,
    organization: DocumentOrganization,
    teams: MyTeam[]
): void {
    openAppModal({
        title: (
            <AppTitle
                title={m.teamRegisterTitle()}
                icon={<UsersThreeIcon size={IconSize.MEDIUM} />}
            />
        ),
        size: 460,
        children: (
            <RegisterTeamForm
                documentId={documentId}
                organization={organization}
                teams={teams}
            />
        )
    });
}
