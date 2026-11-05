import { Button, Group } from "@mantine/core";
import { SignInIcon } from "@phosphor-icons/react";
import { createFileRoute } from "@tanstack/react-router";
import { type ReactNode } from "react";
import { PERSONAL_COMPANY_ID } from "@backend/features/auth/personal-company";
import { PageNotice } from "../../components/app-notice";
import { OpenUrlButton } from "../../components/open-url-button";
import { ReportButton } from "../../features/feedback/components/report-button";
import {
    type OnshapeLaunch,
    OnshapeLaunchType
} from "../../lib/onshape-launch";
import { parseSearch } from "../../lib/search-params";
import { APPLICATIONS_PATH, toOnshapeOrigin } from "../../lib/url";
import { m } from "../../paraglide/messages";

export const Route = createFileRoute("/_pages/document-access")({
    component: DocumentAccess,
    validateSearch: (search) => parseSearch(OnshapeLaunchType, search)
});

/**
 * Where `/init` sends a launch whose Onshape grant can't edit the document.
 * Sign-in grants the session's company, so an Enterprise session can't reach a
 * personal document; a personal session that can't is a classroom that hasn't
 * authorized the app.
 */
function DocumentAccess(): ReactNode {
    const launch = Route.useSearch();
    const inEnterprise =
        !!launch.sessionCompanyId &&
        launch.sessionCompanyId !== PERSONAL_COMPANY_ID;
    return inEnterprise ? (
        <EnterpriseSession launch={launch} />
    ) : (
        <ClassroomAccess launch={launch} />
    );
}

interface EnterpriseSessionProps {
    launch: OnshapeLaunch;
}

function EnterpriseSession(props: EnterpriseSessionProps): ReactNode {
    const { launch } = props;
    const title = m.documentAccessTitle();
    return (
        <PageNotice
            title={title}
            description={m.documentAccessEnterprise()}
            action={
                <Group gap="xs" justify="center" wrap="wrap">
                    <Button
                        leftSection={<SignInIcon />}
                        onClick={() => signInToPersonalAccount(launch)}
                    >
                        {m.documentAccessSignIn()}
                    </Button>
                    <ReportButton
                        report={{ shown: title, kind: "enterprise-session" }}
                    />
                </Group>
            }
        />
    );
}

/**
 * Asks for no company, so Onshape lets them choose their personal account, and
 * returns to `/init` without the Enterprise, which then expects that account.
 */
function signInToPersonalAccount(launch: OnshapeLaunch): void {
    const entries = Object.entries(launch).filter(
        (entry): entry is [string, string] =>
            typeof entry[1] === "string" && entry[0] !== "sessionCompanyId"
    );
    const query = new URLSearchParams({
        redirectUrl: `/init?${new URLSearchParams(entries).toString()}`
    });
    window.location.href = `/auth/sign-in?${query.toString()}`;
}

interface ClassroomAccessProps {
    launch: OnshapeLaunch;
}

function ClassroomAccess(props: ClassroomAccessProps): ReactNode {
    const { launch } = props;
    const title = m.documentAccessTitle();
    return (
        <PageNotice
            title={title}
            description={m.documentAccessClassroom()}
            action={
                <Group gap="xs" justify="center" wrap="wrap">
                    {/* The caller's Onshape, so the page opens on their account. */}
                    <OpenUrlButton
                        text={m.documentAccessOpenApplications()}
                        url={toOnshapeOrigin(launch.server) + APPLICATIONS_PATH}
                    />
                    <ReportButton
                        report={{ shown: title, kind: "classroom" }}
                    />
                </Group>
            }
        />
    );
}
