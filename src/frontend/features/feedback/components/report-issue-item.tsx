import { Menu } from "@mantine/core";
import { FlagIcon } from "@phosphor-icons/react";
import { type ReactNode } from "react";
import { Hint } from "@backend/features/hints/contract";
import { DotIndicator } from "../../../components/dot-indicator";
import { useLibraryId } from "../../../lib/library";
import { useHasSeenHint } from "../../hints/queries";
import { openPartReport } from "../open-feedback";
import { type ReportedPartChoice } from "./feedback-form";

/** Opens a report about the part, dotted until a menu offering it has been opened. */
export function ReportIssueItem(props: ReportedPartChoice): ReactNode {
    const libraryId = useLibraryId();
    const hasOpened = useHasSeenHint(Hint.OPENED_REPORT_ISSUE);
    return (
        <Menu.Item
            leftSection={
                <DotIndicator shown={!hasOpened} offset={-1}>
                    <FlagIcon />
                </DotIndicator>
            }
            onClick={() => openPartReport(libraryId, props)}
        >
            Report an issue
        </Menu.Item>
    );
}
