/** Separate so the component file exports only components, which React Refresh needs. */
import {
    ChatCircleTextIcon,
    FlagIcon,
    WarningIcon
} from "@phosphor-icons/react";
import {
    FeedbackSource,
    FeedbackTopic,
    libraryTopic
} from "@backend/features/feedback/contract";
import { type LibraryId } from "@backend/features/library/library-id";
import { openAppModal } from "../../components/open-app-modal";
import { AppTitle } from "../../components/app-title";
import { IconSize } from "../../lib/style-constants";
import {
    FeedbackForm,
    type ReportedPartChoice
} from "./components/feedback-form";
import { type ReportedError } from "./diagnostics";

const REPORT_MODAL_SIZE = 500;

/** The form in settings: anything about the app or a library. */
export function openFeedbackForm(initialTopic = FeedbackTopic.APP): void {
    openAppModal({
        title: (
            <AppTitle
                title="Send feedback"
                icon={<ChatCircleTextIcon size={IconSize.MEDIUM} />}
            />
        ),
        size: REPORT_MODAL_SIZE,
        children: (
            <FeedbackForm
                initialTopic={initialTopic}
                source={FeedbackSource.GENERAL}
            />
        )
    });
}

/** From a part's menu: about that part, in its library. */
export function openPartReport(
    libraryId: LibraryId,
    part: ReportedPartChoice
): void {
    openAppModal({
        title: (
            <AppTitle
                title="Report an issue"
                icon={<FlagIcon size={IconSize.MEDIUM} />}
            />
        ),
        size: REPORT_MODAL_SIZE,
        children: (
            <FeedbackForm
                initialTopic={libraryTopic(libraryId)}
                source={FeedbackSource.PART}
                part={part}
            />
        )
    });
}

/** From an error's Report button, carrying the error. */
export function openErrorReport(
    error: ReportedError,
    initialTopic = FeedbackTopic.APP
): void {
    openAppModal({
        title: (
            <AppTitle
                title="Send a report"
                icon={<WarningIcon size={IconSize.MEDIUM} />}
            />
        ),
        size: REPORT_MODAL_SIZE,
        children: (
            <FeedbackForm
                initialTopic={initialTopic}
                source={FeedbackSource.ERROR}
                error={error}
            />
        )
    });
}
