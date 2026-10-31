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
import * as z from "zod";
import {
    DOCUMENT_ACCESS_PROBLEM_PARAM,
    DocumentAccessProblem
} from "@backend/features/entry/contract";
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

const DocumentAccessSearch = OnshapeLaunchType.extend({
    [DOCUMENT_ACCESS_PROBLEM_PARAM]: z
        .enum(DocumentAccessProblem)
        .catch(DocumentAccessProblem.WRONG_ACCOUNT)
});

export const Route = createFileRoute("/_pages/document-access")({
    component: DocumentAccess,
    validateSearch: (search) => parseSearch(DocumentAccessSearch, search)
});

/** What `/init` was launched with, to go back through it or on to the app. */
function launchQuery(launch: OnshapeLaunch): string {
    const entries = Object.entries(launch).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string"
    );
    return new URLSearchParams(entries).toString();
}

/** Where `/init` sends a launch whose Onshape grant can't edit the document. */
function DocumentAccess(): ReactNode {
    const { problem, ...launch } = Route.useSearch();
    const origin = toOnshapeOrigin(launch.server);
    const query = launchQuery(launch);
    const isEnterprise =
        !!launch.sessionCompanyId &&
        launch.sessionCompanyId !== PERSONAL_COMPANY_ID;

    const copy =
        problem === DocumentAccessProblem.READ_ONLY
            ? readOnlyCopy()
            : wrongAccountCopy(isEnterprise, origin);

    return (
        <>
            <NavbarRow />
            <Container size="sm" py="xl">
                <Stack gap="lg">
                    <Stack gap="xs">
                        <Title order={2}>{copy.title}</Title>
                        <Text size="md" c="dimmed">
                            {copy.description}
                        </Text>
                    </Stack>
                    <List type="ordered" spacing="lg">
                        {copy.steps.map((step) => (
                            <List.Item key={step.key}>{step.content}</List.Item>
                        ))}
                    </List>
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
                        <ReportButton
                            report={{ shown: copy.title, kind: problem }}
                        />
                    </Group>
                </Stack>
            </Container>
        </>
    );
}

interface AccessStep {
    key: string;
    content: ReactNode;
}

interface AccessCopy {
    title: string;
    description: string;
    steps: AccessStep[];
}

function wrongAccountCopy(isEnterprise: boolean, origin: string): AccessCopy {
    const account = isEnterprise ? "the Enterprise" : "your personal account";
    const steps: AccessStep[] = [
        {
            key: "revoke",
            content: (
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
            )
        }
    ];
    if (isEnterprise) {
        steps.push({
            key: "admin",
            content:
                "If your Enterprise limits which apps its members can use, ask an Enterprise admin to allow the FRCDesignApp."
        });
    }
    steps.push({
        key: "grant",
        content: `Click Try again below. When Onshape asks, grant the FRCDesignApp access to ${account}.`
    });
    return {
        title: "The FRCDesignApp can't edit this document",
        description: isEnterprise
            ? "This document belongs to an Onshape Enterprise, but the FRCDesignApp was given access to a different account, usually your personal one. Parts can't be inserted until the app has access to the Enterprise."
            : "This document belongs to your personal Onshape account, but the FRCDesignApp was given access to an Enterprise instead. Parts can't be inserted until the app has access to your personal account.",
        steps
    };
}

function readOnlyCopy(): AccessCopy {
    return {
        title: "You can't edit this document",
        description:
            "You can view this document but not edit it, so parts can't be inserted into it.",
        steps: [
            {
                key: "share",
                content:
                    "Ask the document's owner to share it with you with edit access."
            },
            {
                key: "copy",
                content:
                    "Or make a copy of the document, and open the FRCDesignApp in the copy."
            }
        ]
    };
}
