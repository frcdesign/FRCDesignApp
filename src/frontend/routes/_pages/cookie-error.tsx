import type { JSX } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PageError } from "../../components/app-zero-state";

export const Route = createFileRoute("/_pages/cookie-error")({
    component: CookieError
});

function CookieError(): JSX.Element {
    return (
        <PageError
            title="Cannot Set Authentication Cookie"
            description="The FRCDesignApp could not set an authentication cookie. Please try clearing your cookies and ensure your browser is set to allow cookies from third-party sites. If the problem persists, contact the FRCDesignApp developers."
        />
    );
}
