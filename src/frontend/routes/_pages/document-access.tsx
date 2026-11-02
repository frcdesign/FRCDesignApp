import { Button, Container, Group, Stack, Text, Title } from "@mantine/core";
import { ArrowClockwiseIcon, ArrowRightIcon } from "@phosphor-icons/react";
import { createFileRoute } from "@tanstack/react-router";
import { type ReactNode } from "react";
import { PERSONAL_COMPANY_ID } from "@backend/features/auth/personal-company";
import { NavbarRow } from "../../components/app-navbar";
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

/** What `/init` was launched with, to go back through it or on to the app. */
function launchQuery(launch: OnshapeLaunch): string {
    const entries = Object.entries(launch).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string"
    );
    return new URLSearchParams(entries).toString();
}

/**
 * Where `/init` sends a launch whose Onshape grant can't edit the document.
 * Onshape can't tell a grant for another account from a document that is only
 * shared to view, since a public document is visible to both; the page names
 * both, and says how to fix the one the app can do something about.
 */
function DocumentAccess(): ReactNode {
    const launch = Route.useSearch();
    const query = launchQuery(launch);
    const isEnterprise =
        !!launch.sessionCompanyId &&
        launch.sessionCompanyId !== PERSONAL_COMPANY_ID;

    return (
        <>
            <NavbarRow />
            <Container size="sm" py="xl">
                <Stack gap="lg">
                    <Stack gap="xs">
                        <Title order={2}>{m.documentAccessTitle()}</Title>
                        <Text size="md" c="dimmed">
                            {m.documentAccessIntro()}
                        </Text>
                    </Stack>
                    <AccessSteps
                        isEnterprise={isEnterprise}
                        origin={toOnshapeOrigin(launch.server)}
                    />
                    {/* The panel is too narrow for three labels on one line. */}
                    <Group gap="sm" wrap="wrap">
                        <Button
                            leftSection={<ArrowClockwiseIcon />}
                            onClick={() => {
                                window.location.href = `/init?${query}`;
                            }}
                        >
                            {m.documentAccessTryAgain()}
                        </Button>
                        {/* Browsing still works; only inserting needs the access. */}
                        <Button
                            variant="default"
                            leftSection={<ArrowRightIcon />}
                            onClick={() => {
                                window.location.href = `/?${query}`;
                            }}
                        >
                            {m.documentAccessContinue()}
                        </Button>
                        <ReportButton
                            report={{ shown: m.documentAccessTitle() }}
                        />
                    </Group>
                </Stack>
            </Container>
        </>
    );
}

interface AccessStepsProps {
    isEnterprise: boolean;
    /** The caller's Onshape, so the Applications page opens on their company. */
    origin: string;
}

/**
 * Granting the app to the document's account is enough; the other grant can
 * stay. A classroom is granted on the Applications page, never by sign-in.
 */
function AccessSteps(props: AccessStepsProps): ReactNode {
    const { isEnterprise, origin } = props;
    if (isEnterprise) {
        return (
            <Stack gap="xs">
                <Text size="md">{m.documentAccessEnterprise()}</Text>
                <Text size="md">{m.documentAccessEnterpriseAdmin()}</Text>
            </Stack>
        );
    }
    return (
        <Stack gap="md">
            <Stack gap="xs" align="flex-start">
                <Text size="md">{m.documentAccessClassroom()}</Text>
                <OpenUrlButton
                    text={m.documentAccessOpenApplications()}
                    url={origin + APPLICATIONS_PATH}
                />
            </Stack>
            <Text size="md">{m.documentAccessPersonal()}</Text>
        </Stack>
    );
}
