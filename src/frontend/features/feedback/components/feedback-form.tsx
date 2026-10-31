import {
    Button,
    Checkbox,
    Select,
    Text,
    Textarea,
    TextInput
} from "@mantine/core";
import { PaperPlaneTiltIcon } from "@phosphor-icons/react";
import { type ReactNode, useState } from "react";
import {
    FEEDBACK_CATEGORY_LABELS,
    FEEDBACK_TOPIC_LABELS,
    FEEDBACK_TOPICS,
    feedbackCategories,
    FeedbackCategory,
    FeedbackSource,
    FeedbackTopic,
    MAX_FEEDBACK_MESSAGE,
    MAX_FEEDBACK_TITLE,
    suggestTitle,
    topicLibrary
} from "@backend/features/feedback/contract";
import {
    type PartialSelection,
    type Selection
} from "@backend/features/configurations/contract";
import { type InsertableOut } from "@backend/features/library/contract";
import { AppModalBody, AppModalFooter } from "../../../components/app-modal";
import { useAppModal } from "../../../components/open-app-modal";
import { Callout } from "../../../components/callout";
import { Status } from "../../../lib/status";
import { collectDiagnostics, type ReportedError } from "../diagnostics";
import { useSendFeedbackMutation } from "../queries";

/** The part a report from its menu names, and the configuration on screen. */
export interface ReportedPartChoice {
    insertable: InsertableOut;
    /** What the menu had selected; the part's defaults when absent. */
    selection?: PartialSelection;
}

const MESSAGE_PLACEHOLDERS: Partial<Record<FeedbackCategory, string>> = {
    [FeedbackCategory.BUG]:
        "What did you do, what happened, and what did you expect?",
    [FeedbackCategory.FEATURE_REQUEST]: "What would you like the app to do?",
    [FeedbackCategory.PART_REQUEST]:
        "Which part would you like added? A link to where it's sold helps.",
    [FeedbackCategory.METADATA]:
        "Which field is wrong or missing, and what should it be?",
    [FeedbackCategory.INCORRECT_PART]: "What doesn't match the real part?",
    [FeedbackCategory.BROKEN_CONFIGURATION]: "Which options break, and how?",
    [FeedbackCategory.INSERT_FAILED]: "What happens when you insert it?"
};

const DEFAULT_PLACEHOLDER = "Tell us more.";

/** The values a selection names; the server fills in the rest from the part's defaults. */
function namedValues(selection: PartialSelection = {}): Selection {
    return Object.fromEntries(
        Object.entries(selection).filter(
            (entry): entry is [string, string] => entry[1] !== undefined
        )
    );
}

interface FeedbackFormProps {
    initialTopic: FeedbackTopic;
    source: FeedbackSource;
    /** Set for a report from a part's menu. */
    part?: ReportedPartChoice;
    /** Set for a report from an error. */
    error?: ReportedError;
}

/** One form for every report; what it was opened from decides what it offers. */
export function FeedbackForm(props: FeedbackFormProps): ReactNode {
    const { source, part, error } = props;
    const modal = useAppModal();
    const sendMutation = useSendFeedbackMutation(modal.close);

    const [topic, setTopic] = useState(props.initialTopic);
    const categories = feedbackCategories(topic, source);
    const [chosenCategory, setChosenCategory] = useState(categories[0]);
    // A topic change can leave the chosen category behind.
    const category = categories.includes(chosenCategory)
        ? chosenCategory
        : categories[0];
    // Undefined until edited, so the suggestion follows the topic and type.
    const [editedTitle, setEditedTitle] = useState<string>();
    const [message, setMessage] = useState("");
    const [contact, setContact] = useState("");
    const [includeConfiguration, setIncludeConfiguration] = useState(true);

    const title =
        editedTitle ??
        suggestTitle({
            topic,
            category,
            partName: part?.insertable.name,
            errorShown: error?.shown
        });
    const canSend =
        title.trim().length > 0 &&
        (message.trim().length > 0 || error !== undefined);

    const send = () => {
        sendMutation.mutate({
            topic,
            category,
            source,
            title: title.trim(),
            message: message.trim(),
            contact: contact.trim() || undefined,
            part: part && {
                insertableId: part.insertable.id,
                selection: includeConfiguration
                    ? namedValues(part.selection)
                    : undefined
            },
            diagnostics: collectDiagnostics(error)
        });
    };

    return (
        <>
            <AppModalBody>
                {error && (
                    <Callout
                        status={Status.ERROR}
                        text={`The report includes this error: ${error.shown}`}
                    />
                )}
                {part ? (
                    <Text>
                        About <b>{part.insertable.name}</b> in{" "}
                        {FEEDBACK_TOPIC_LABELS[topic]}.
                    </Text>
                ) : (
                    <Select
                        label="About"
                        data={FEEDBACK_TOPICS.map((value) => ({
                            value,
                            label: FEEDBACK_TOPIC_LABELS[value]
                        }))}
                        value={topic}
                        allowDeselect={false}
                        checkIconPosition="right"
                        onChange={(value) => {
                            if (value) setTopic(value);
                        }}
                    />
                )}
                {!part && topicLibrary(topic) && (
                    <Callout text="To report a problem with one part, choose Report an issue in that part's menu." />
                )}
                <Select
                    label="Type"
                    data={categories.map((value) => ({
                        value,
                        label: FEEDBACK_CATEGORY_LABELS[value]
                    }))}
                    value={category}
                    allowDeselect={false}
                    checkIconPosition="right"
                    onChange={(value) => {
                        if (value) setChosenCategory(value);
                    }}
                />
                <TextInput
                    label="Title"
                    description="Names the report's thread in Discord."
                    required
                    maxLength={MAX_FEEDBACK_TITLE}
                    value={title}
                    onChange={(event) =>
                        setEditedTitle(event.currentTarget.value)
                    }
                />
                <Textarea
                    label="Details"
                    placeholder={
                        MESSAGE_PLACEHOLDERS[category] ?? DEFAULT_PLACEHOLDER
                    }
                    autosize
                    minRows={4}
                    maxRows={10}
                    maxLength={MAX_FEEDBACK_MESSAGE}
                    required={error === undefined}
                    value={message}
                    onChange={(event) => setMessage(event.currentTarget.value)}
                    data-autofocus
                />
                {part?.insertable.isConfigurable && (
                    <Checkbox
                        label="Include the configuration"
                        checked={includeConfiguration}
                        onChange={(event) =>
                            setIncludeConfiguration(event.currentTarget.checked)
                        }
                    />
                )}
                <TextInput
                    label="How can we reach you?"
                    description="Optional: a Discord username or an email address."
                    value={contact}
                    onChange={(event) => setContact(event.currentTarget.value)}
                />
                <Text size="sm" c="dimmed">
                    Sent with the page you're on, your Onshape user id, and your
                    browser, to help find the problem.
                </Text>
            </AppModalBody>
            <AppModalFooter>
                <Button variant="default" onClick={modal.close}>
                    Cancel
                </Button>
                <Button
                    leftSection={<PaperPlaneTiltIcon />}
                    disabled={!canSend}
                    loading={sendMutation.isPending}
                    onClick={send}
                >
                    Send
                </Button>
            </AppModalFooter>
        </>
    );
}
