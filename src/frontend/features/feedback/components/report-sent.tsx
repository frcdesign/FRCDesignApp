import { Button } from "@mantine/core";
import { DiscordLogoIcon } from "@phosphor-icons/react";
import { type ReactNode } from "react";
import {
    FeedbackCategory,
    type FeedbackTopic
} from "@backend/features/feedback/contract";
import {
    forumInvite,
    topicForum
} from "@backend/features/feedback/discord-forums";
import { AppModalBody, AppModalFooter } from "../../../components/app-modal";
import { SectionNotice } from "../../../components/app-notice";
import { StatusIcon } from "../../../components/status-icon";
import { Status } from "../../../lib/status";
import { IconSize } from "../../../lib/style-constants";
import { openUrlInNewTab } from "../../../lib/url";
import { m } from "../../../paraglide/messages";

interface ReportSentProps {
    /** Decides the forum the report went to. */
    topic: FeedbackTopic;
    /** A question is answered only in Discord, so it is told to go there. */
    category: FeedbackCategory;
    onClose: () => void;
}

/** Replies happen only in the report's Discord thread, so say where it is. */
export function ReportSent(props: ReportSentProps): ReactNode {
    const { topic, category, onClose } = props;
    const channel = topicForum(topic).channel;
    return (
        <>
            <AppModalBody>
                <SectionNotice
                    icon={
                        <StatusIcon
                            status={Status.SUCCESS}
                            size={IconSize.PAGE}
                            raised={false}
                        />
                    }
                    title={m.feedbackSent()}
                    description={
                        category === FeedbackCategory.QUESTION
                            ? m.feedbackSentQuestionWhere({ channel })
                            : m.feedbackSentWhere({ channel })
                    }
                    action={
                        <Button
                            leftSection={<DiscordLogoIcon />}
                            onClick={() => openUrlInNewTab(forumInvite(topic))}
                        >
                            {m.feedbackOpenDiscord()}
                        </Button>
                    }
                />
            </AppModalBody>
            <AppModalFooter>
                <Button variant="default" ml="auto" onClick={onClose}>
                    {m.feedbackClose()}
                </Button>
            </AppModalFooter>
        </>
    );
}
