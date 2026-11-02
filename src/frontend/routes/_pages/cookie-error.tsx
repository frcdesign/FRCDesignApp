import type { JSX } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PageNotice } from "../../components/app-notice";
import { m } from "../../paraglide/messages";
import { ReportButton } from "../../features/feedback/components/report-button";

export const Route = createFileRoute("/_pages/cookie-error")({
    component: CookieError
});

function CookieError(): JSX.Element {
    return (
        <PageNotice
            title={m.cookieErrorTitle()}
            description={m.cookieErrorDescription()}
            action={<ReportButton report={{ shown: m.cookieErrorTitle() }} />}
        />
    );
}
