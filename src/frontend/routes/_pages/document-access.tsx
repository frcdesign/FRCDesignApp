import { Button, Group } from "@mantine/core";
import { ArrowClockwiseIcon } from "@phosphor-icons/react";
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
 * personal document; a personal session that can't is most often a classroom
 * that hasn't authorized the app.
 */
function DocumentAccess(): ReactNode {
    const launch = Route.useSearch();
    const inEnterprise =
        !!launch.sessionCompanyId &&
        launch.sessionCompanyId !== PERSONAL_COMPANY_ID;
    return inEnterprise ? (
        <EnterpriseSession />
    ) : (
        <ClassroomAccess launch={launch} />
    );
}

function EnterpriseSession(): ReactNode {
    const title = m.documentAccessEnterpriseTitle();
    return (
        <PageNotice
            title={title}
            description={m.documentAccessEnterpriseDescription()}
            action={<ReportButton report={{ shown: title }} />}
        />
    );
}

interface ClassroomAccessProps {
    launch: OnshapeLaunch;
}

function ClassroomAccess(props: ClassroomAccessProps): ReactNode {
    const { launch } = props;
    const title = m.documentAccessClassroomTitle();
    const query = new URLSearchParams(
        Object.entries(launch).filter(
            (entry): entry is [string, string] => typeof entry[1] === "string"
        )
    ).toString();
    return (
        <PageNotice
            title={title}
            description={m.documentAccessClassroomDescription()}
            action={
                <Group gap="xs" justify="center" wrap="wrap">
                    {/* The caller's Onshape, so the page opens on their account. */}
                    <OpenUrlButton
                        text={m.documentAccessOpenApplications()}
                        url={toOnshapeOrigin(launch.server) + APPLICATIONS_PATH}
                    />
                    <Button
                        variant="default"
                        leftSection={<ArrowClockwiseIcon />}
                        onClick={() => {
                            window.location.href = `/init?${query}`;
                        }}
                    >
                        {m.documentAccessTryAgain()}
                    </Button>
                    <ReportButton report={{ shown: title }} />
                </Group>
            }
        />
    );
}
