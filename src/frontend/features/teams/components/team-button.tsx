import { ActionIcon } from "@mantine/core";
import { UsersThreeIcon } from "@phosphor-icons/react";
import { ReactNode } from "react";
import { TeamContextSource } from "@backend/features/teams/contract";
import { IconSize } from "../../../lib/style-constants";
import { useOnshapeLaunch } from "../../../lib/onshape-params";
import { m } from "../../../paraglide/messages";
import { useIsSignedIn } from "../../auth/access-level";
import { openRegisterTeam } from "../open-register";
import { openTeamPanel } from "../open-team-panel";
import { useTeamContextQuery } from "../queries";

/**
 * The navbar's Team, beside settings. In an organization's document no team
 * of the caller's holds, an admin of it goes straight to registering.
 */
export function TeamButton(): ReactNode {
    const isSignedIn = useIsSignedIn();
    const context = useTeamContextQuery().data;
    const documentId = useOnshapeLaunch((state) => state.documentId);

    if (!isSignedIn) return null;
    const organization = context?.organization;
    const shouldRegister =
        documentId !== undefined &&
        organization?.isAdmin === true &&
        context?.current?.source !== TeamContextSource.DOCUMENT;

    return (
        <ActionIcon
            title={m.teamButton()}
            my="auto"
            size="input-sm"
            onClick={() => {
                if (shouldRegister && context) {
                    openRegisterTeam(documentId, organization, context.teams);
                } else {
                    openTeamPanel();
                }
            }}
        >
            <UsersThreeIcon size={IconSize.CONTROL} />
        </ActionIcon>
    );
}
