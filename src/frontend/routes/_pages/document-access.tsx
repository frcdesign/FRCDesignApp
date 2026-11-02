import { Button, Container, Group, Stack, Text, Title } from "@mantine/core";
import { ArrowClockwiseIcon, ArrowRightIcon } from "@phosphor-icons/react";
import { createFileRoute } from "@tanstack/react-router";
import { type ReactNode } from "react";
import { PERSONAL_COMPANY_ID } from "@backend/features/auth/personal-company";
import { NavbarRow } from "../../components/app-navbar";
import { ReportButton } from "../../features/feedback/components/report-button";
import {
    type OnshapeLaunch,
    OnshapeLaunchType
} from "../../lib/onshape-launch";
import { parseSearch } from "../../lib/search-params";

export const Route = createFileRoute("/_pages/document-access")({
    component: DocumentAccess,
    validateSearch: (search) => parseSearch(OnshapeLaunchType, search)
});

const TITLE = "The FRCDesignApp can't edit this document";

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
                        <Title order={2}>{TITLE}</Title>
                        <Text size="md" c="dimmed">
                            Parts can only be inserted into a document the
                            FRCDesignApp can edit. Either the app was given
                            access to a different Onshape account than this
                            document&apos;s, or you can only view this document.
                        </Text>
                    </Stack>
                    <WrongAccountSteps isEnterprise={isEnterprise} />
                    {/* The panel is too narrow for three labels on one line. */}
                    <Group gap="sm" wrap="wrap">
                        <Button
                            leftSection={<ArrowClockwiseIcon />}
                            onClick={() => {
                                window.location.href = `/init?${query}`;
                            }}
                        >
                            Try again
                        </Button>
                        {/* Browsing still works; only inserting needs the access. */}
                        <Button
                            variant="default"
                            leftSection={<ArrowRightIcon />}
                            onClick={() => {
                                window.location.href = `/?${query}`;
                            }}
                        >
                            Continue anyway
                        </Button>
                        <ReportButton report={{ shown: TITLE }} />
                    </Group>
                </Stack>
            </Container>
        </>
    );
}

interface WrongAccountStepsProps {
    isEnterprise: boolean;
}

/** Granting the app to the document's account is enough; the other grant can stay. */
function WrongAccountSteps(props: WrongAccountStepsProps): ReactNode {
    const { isEnterprise } = props;
    return (
        <Stack gap="xs">
            <Text size="md">
                {isEnterprise
                    ? "This document belongs to an Onshape Enterprise, but the FRCDesignApp was probably given access to your personal account instead. Click Try again below, and when Onshape asks, grant the FRCDesignApp access to the Enterprise."
                    : "This document belongs to your personal Onshape account, but the FRCDesignApp was probably given access to an Enterprise instead. Click Try again below, and when Onshape asks, grant the FRCDesignApp access to your personal account."}
            </Text>
            {isEnterprise && (
                <Text size="md">
                    If your Enterprise limits which apps its members can use,
                    ask an Enterprise admin to allow the FRCDesignApp.
                </Text>
            )}
        </Stack>
    );
}
