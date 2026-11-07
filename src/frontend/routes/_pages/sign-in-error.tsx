import { Button, Group } from "@mantine/core";
import { SignInIcon } from "@phosphor-icons/react";
import { createFileRoute } from "@tanstack/react-router";
import { type ReactNode } from "react";
import { SignInErrorSearch } from "@backend/features/auth/sign-in-error";
import { PageNotice } from "../../components/app-notice";
import { ReportButton } from "../../features/feedback/components/report-button";
import { parseSearch } from "../../lib/search-params";
import { m } from "../../paraglide/messages";

export const Route = createFileRoute("/_pages/sign-in-error")({
    component: SignInError,
    validateSearch: (search) => parseSearch(SignInErrorSearch, search)
});

/** Where the callback sends a sign-in Onshape refused, or answered with nothing to use. */
function SignInError(): ReactNode {
    const { error, description, redirectUrl } = Route.useSearch();
    const title = m.signInErrorTitle();

    return (
        <PageNotice
            title={title}
            description={
                description
                    ? m.signInErrorDescriptionWithReason({
                          reason: description
                      })
                    : m.signInErrorDescription()
            }
            action={
                <Group gap="xs" justify="center" wrap="wrap">
                    <Button
                        leftSection={<SignInIcon />}
                        onClick={() => signInAgain(redirectUrl)}
                    >
                        {m.signInErrorSignIn()}
                    </Button>
                    <ReportButton
                        report={{
                            shown: title,
                            kind: error,
                            detail: description
                        }}
                    />
                </Group>
            }
        />
    );
}

/** Asks for no company, so Onshape lets the caller choose which account. */
function signInAgain(redirectUrl = "/"): void {
    const query = new URLSearchParams({ redirectUrl });
    window.location.href = `/auth/sign-in?${query.toString()}`;
}
