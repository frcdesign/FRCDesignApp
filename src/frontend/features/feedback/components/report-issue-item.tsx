import { Menu } from "@mantine/core";
import { FlagIcon } from "@phosphor-icons/react";
import { type ReactNode } from "react";
import { Hint } from "@backend/features/hints/contract";
import { NewIndicator } from "../../../components/new-feature";
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
                <NewIndicator shown={!hasOpened} offset={-1}>
                    {/* Inline, it sits on a line of text above the label's center */}
                    <FlagIcon style={{ display: "block" }} />
                </NewIndicator>
            }
            onClick={() => openPartReport(libraryId, props)}
        >
            Report an issue
        </Menu.Item>
    );
}
