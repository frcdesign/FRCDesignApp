import {
    Button,
    Checkbox,
    NumberInput,
    Select,
    Textarea,
    TextInput
} from "@mantine/core";
import { PaperPlaneTiltIcon } from "@phosphor-icons/react";
import { ReportSent } from "./report-sent";
import { type ReactNode, useState } from "react";
import {
    FEEDBACK_TOPICS,
    type FeedbackOut,
    feedbackCategories,
    FeedbackSource,
    FeedbackTopic,
    MAX_FEEDBACK_MESSAGE,
    MAX_FEEDBACK_TITLE,
    MAX_TEAM_NUMBER,
    topicLibrary
} from "@backend/features/feedback/contract";
import { type PartialSelection } from "@backend/features/configurations/contract";
import { namedValues } from "@backend/features/configurations/selection";
import { type InsertableOut } from "@backend/features/library/contract";
import { AppModalBody, AppModalFooter } from "../../../components/app-modal";
import { useAppModal } from "../../../components/open-app-modal";
import { Callout } from "../../../components/callout";
import { Status } from "../../../lib/status";
import { collectDiagnostics, type ReportedError } from "../diagnostics";
import { useSendFeedbackMutation } from "../queries";
import {
    descriptionPlaceholder,
    suggestTitle,
    topicLabel,
    typeLabel
} from "../labels";
import { m } from "../../../paraglide/messages";

/** The part a report from its menu names, and the configuration on screen. */
export interface ReportedPartChoice {
    insertable: InsertableOut;
    /** Set from the insert menu, the only place a configuration is on screen to include. */
    selection?: PartialSelection;
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
    const sendMutation = useSendFeedbackMutation();

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
    // NumberInput gives a string while empty or part-typed.
    const [teamNumber, setTeamNumber] = useState<number | string>("");
    const [includeConfiguration, setIncludeConfiguration] = useState(true);

    const title =
        editedTitle ??
        suggestTitle({
            category,
            partName: part?.insertable.name,
            errorShown: error?.shown
        }) ??
        "";
    const offersConfiguration =
        !!part?.insertable.isConfigurable && part.selection !== undefined;
    const canSend =
        title.trim().length > 0 &&
        (message.trim().length > 0 || error !== undefined);

    const sent: FeedbackOut | undefined = sendMutation.data;
    if (sent) {
        return <ReportSent topic={topic} onClose={modal.close} />;
    }

    const send = () => {
        sendMutation.mutate({
            topic,
            category,
            source,
            title: title.trim(),
            message: message.trim(),
            contact: contact.trim() || undefined,
            teamNumber: typeof teamNumber === "number" ? teamNumber : undefined,
            part: part && {
                insertableId: part.insertable.id,
                selection:
                    part.selection &&
                    offersConfiguration &&
                    includeConfiguration
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
                        text={m.feedbackIncludesError({ error: error.shown })}
                    />
                )}
                {!part && (
                    <Select
                        label={m.feedbackTopicLabel()}
                        data={FEEDBACK_TOPICS.map((value) => ({
                            value,
                            label: topicLabel(value)
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
                    <Callout text={m.feedbackPartMenuCallout()} />
                )}
                <Select
                    label={m.feedbackTypeLabel()}
                    data={categories.map((value) => ({
                        value,
                        label: typeLabel(value)
                    }))}
                    value={category}
                    allowDeselect={false}
                    checkIconPosition="right"
                    onChange={(value) => {
                        if (value) setChosenCategory(value);
                    }}
                />
                <TextInput
                    label={m.feedbackTitleLabel()}
                    placeholder={m.feedbackTitlePlaceholder()}
                    required
                    maxLength={MAX_FEEDBACK_TITLE}
                    value={title}
                    onChange={(event) =>
                        setEditedTitle(event.currentTarget.value)
                    }
                />
                <Textarea
                    label={m.feedbackDescriptionLabel()}
                    placeholder={descriptionPlaceholder(category)}
                    autosize
                    minRows={4}
                    maxRows={10}
                    maxLength={MAX_FEEDBACK_MESSAGE}
                    required={error === undefined}
                    value={message}
                    onChange={(event) => setMessage(event.currentTarget.value)}
                    data-autofocus
                />
                {offersConfiguration && (
                    <Checkbox
                        label={m.feedbackIncludeConfiguration()}
                        checked={includeConfiguration}
                        onChange={(event) =>
                            setIncludeConfiguration(event.currentTarget.checked)
                        }
                    />
                )}
                <TextInput
                    label={m.feedbackDiscordUsername()}
                    value={contact}
                    onChange={(event) => setContact(event.currentTarget.value)}
                />
                <NumberInput
                    label={m.feedbackTeamNumber()}
                    value={teamNumber}
                    onChange={setTeamNumber}
                    min={1}
                    max={MAX_TEAM_NUMBER}
                    allowDecimal={false}
                    allowNegative={false}
                    clampBehavior="strict"
                    hideControls
                />
            </AppModalBody>
            <AppModalFooter>
                <Button variant="default" onClick={modal.close}>
                    {m.feedbackCancel()}
                </Button>
                <Button
                    leftSection={<PaperPlaneTiltIcon />}
                    disabled={!canSend}
                    loading={sendMutation.isPending}
                    onClick={send}
                >
                    {m.feedbackSend()}
                </Button>
            </AppModalFooter>
        </>
    );
}
