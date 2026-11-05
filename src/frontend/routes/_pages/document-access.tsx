import { Button, Group } from "@mantine/core";
import { SignInIcon } from "@phosphor-icons/react";
import { createFileRoute } from "@tanstack/react-router";
import * as z from "zod";
import { type ReactNode } from "react";
import { PERSONAL_COMPANY_ID } from "@backend/features/auth/personal-company";
import {
    ACCESS_PROBLEM_PARAM,
    AccessProblem
} from "@backend/features/entry/access-problem";
import { PageNotice } from "../../components/app-notice";
import { ReportButton } from "../../features/feedback/components/report-button";
import {
    type OnshapeLaunch,
    OnshapeLaunchType
} from "../../lib/onshape-launch";
import { parseSearch } from "../../lib/search-params";
import { m } from "../../paraglide/messages";

const DocumentAccessSearch = OnshapeLaunchType.extend({
    [ACCESS_PROBLEM_PARAM]: z.enum(AccessProblem).optional().catch(undefined)
});

export const Route = createFileRoute("/_pages/document-access")({
    component: DocumentAccess,
    validateSearch: (search) => parseSearch(DocumentAccessSearch, search)
});

/**
 * Where `/init` sends a launch whose Onshape grant can't edit the document.
 * Sign-in asks for the document's own company, so the one grant a caller can
 * get wrong is a company's for a personal document, which Onshape never asks
 * about; anything else that can't edit is view-only.
 */
function DocumentAccess(): ReactNode {
    const { [ACCESS_PROBLEM_PARAM]: problem, ...launch } = Route.useSearch();
    const isPersonalDocument =
        (launch.companyId ?? PERSONAL_COMPANY_ID) === PERSONAL_COMPANY_ID;
    const title = m.documentAccessTitle();

    if (problem === AccessProblem.OTHER_ACCOUNT && isPersonalDocument) {
        return (
            <PageNotice
                title={title}
                description={m.documentAccessOtherAccount()}
                action={
                    <Group gap="xs" justify="center" wrap="wrap">
                        <Button
                            leftSection={<SignInIcon />}
                            onClick={() => signInToPersonalAccount(launch)}
                        >
                            {m.documentAccessSignIn()}
                        </Button>
                        <ReportButton
                            report={{ shown: title, kind: problem }}
                        />
                    </Group>
                }
            />
        );
    }
    return (
        <PageNotice
            title={title}
            description={m.documentAccessViewOnly()}
            action={
                <ReportButton
                    report={{ shown: title, kind: AccessProblem.VIEW_ONLY }}
                />
            }
        />
    );
}

/**
 * Asks for no company, so Onshape lets the caller choose their personal
 * account, and returns to `/init`, which checks the grant against the document.
 */
function signInToPersonalAccount(launch: OnshapeLaunch): void {
    const entries = Object.entries(launch).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string"
    );
    const query = new URLSearchParams({
        redirectUrl: `/init?${new URLSearchParams(entries).toString()}`
    });
    window.location.href = `/auth/sign-in?${query.toString()}`;
}
