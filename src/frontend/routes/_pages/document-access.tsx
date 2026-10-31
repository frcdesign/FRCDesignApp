import {
    Button,
    Container,
    Group,
    List,
    Stack,
    Text,
    Title
} from "@mantine/core";
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
 * shared to view, since a public document is visible to both, so both causes
 * are explained.
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
                    <WrongAccountSteps
                        isEnterprise={isEnterprise}
                        origin={toOnshapeOrigin(launch.server)}
                    />
                    <ViewOnlySteps />
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
    /** The caller's Onshape, so the Applications page opens on their company. */
    origin: string;
}

function WrongAccountSteps(props: WrongAccountStepsProps): ReactNode {
    const { isEnterprise, origin } = props;
    const account = isEnterprise ? "the Enterprise" : "your personal account";
    return (
        <Stack gap="xs">
            <Title order={4}>If you can edit this document in Onshape</Title>
            <Text size="md">
                {isEnterprise
                    ? "The document belongs to an Onshape Enterprise, but the FRCDesignApp was probably given access to your personal account instead."
                    : "The document belongs to your personal Onshape account, but the FRCDesignApp was probably given access to an Enterprise instead."}
            </Text>
            <List type="ordered" spacing="md">
                <List.Item>
                    <Stack gap="xs" align="flex-start">
                        <Text size="md">
                            Open your Onshape Applications page, find the
                            FRCDesignApp, and revoke its access.
                        </Text>
                        <OpenUrlButton
                            text="Open Applications page"
                            url={origin + APPLICATIONS_PATH}
                        />
                    </Stack>
                </List.Item>
                {isEnterprise && (
                    <List.Item>
                        If your Enterprise limits which apps its members can
                        use, ask an Enterprise admin to allow the FRCDesignApp.
                    </List.Item>
                )}
                <List.Item>
                    Click Try again below. When Onshape asks, grant the
                    FRCDesignApp access to {account}.
                </List.Item>
            </List>
        </Stack>
    );
}

function ViewOnlySteps(): ReactNode {
    return (
        <Stack gap="xs">
            <Title order={4}>If you can only view this document</Title>
            <Text size="md">
                Public documents, and documents shared to view, can&apos;t be
                inserted into.
            </Text>
            <List spacing="md">
                <List.Item>
                    Ask the document&apos;s owner to share it with you with edit
                    access.
                </List.Item>
                <List.Item>
                    Or make a copy of the document, and open the FRCDesignApp in
                    the copy.
                </List.Item>
            </List>
        </Stack>
    );
}
