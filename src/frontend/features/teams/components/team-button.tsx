import { ActionIcon } from "@mantine/core";
import { UsersThreeIcon } from "@phosphor-icons/react";
import { ReactNode, useEffect } from "react";
import { TeamContextSource } from "@backend/features/teams/contract";
import { IconSize } from "../../../lib/style-constants";
import { useOnshapeLaunch } from "../../../lib/onshape-params";
import { m } from "../../../paraglide/messages";
import { useIsSignedIn } from "../../auth/access-level";
import { JOIN_TEAM_PARAM } from "../invite";
import { openRegisterTeam } from "../open-register";
import { openTeamPanel } from "../open-team-panel";
import { useJoinTeamMutation, useTeamContextQuery } from "../queries";

/**
 * The navbar's Team, beside settings. In an organization's document no team
 * of the caller's holds, an admin of it goes straight to registering.
 */
export function TeamButton(): ReactNode {
    const isSignedIn = useIsSignedIn();
    const context = useTeamContextQuery().data;
    const documentId = useOnshapeLaunch((state) => state.documentId);
    useJoinFromInviteLink(isSignedIn);

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

/** An invite link opens the app with its token, which is spent and dropped from the url. */
function useJoinFromInviteLink(isSignedIn: boolean): void {
    const joinMutation = useJoinTeamMutation();
    const { mutate } = joinMutation;
    useEffect(() => {
        if (!isSignedIn) return;
        const url = new URL(window.location.href);
        const token = url.searchParams.get(JOIN_TEAM_PARAM);
        if (!token) return;
        url.searchParams.delete(JOIN_TEAM_PARAM);
        window.history.replaceState(window.history.state, "", url.href);
        mutate(token);
    }, [isSignedIn, mutate]);
}
