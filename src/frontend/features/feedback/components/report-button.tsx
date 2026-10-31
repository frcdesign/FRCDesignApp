import { Button } from "@mantine/core";
import { FlagIcon } from "@phosphor-icons/react";
import { type ReactNode } from "react";
import { FeedbackTopic } from "@backend/features/feedback/contract";
import { type ReportedError } from "../diagnostics";
import { openErrorReport } from "../open-feedback";

interface ReportButtonProps {
    /** The problem on screen, which the report carries; see `toReportedError`. */
    report: ReportedError;
    /** @default FeedbackTopic.APP */
    topic?: FeedbackTopic;
}

export function ReportButton(props: ReportButtonProps): ReactNode {
    const { report, topic = FeedbackTopic.APP } = props;
    return (
        <Button
            variant="default"
            leftSection={<FlagIcon />}
            onClick={() => openErrorReport(report, topic)}
        >
            Send a report
        </Button>
    );
}
