import type { JSX } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PageNotice, SEND_A_REPORT } from "../../components/app-notice";
import { ReportButton } from "../../features/feedback/components/report-button";

export const Route = createFileRoute("/_pages/cookie-error")({
    component: CookieError
});

const TITLE = "Cannot Set Authentication Cookie";

function CookieError(): JSX.Element {
    return (
        <PageNotice
            title={TITLE}
            description={`The FRCDesignApp could not set an authentication cookie. Please try clearing your cookies and ensure your browser is set to allow cookies from third-party sites. ${SEND_A_REPORT}`}
            action={<ReportButton report={{ shown: TITLE }} />}
        />
    );
}
