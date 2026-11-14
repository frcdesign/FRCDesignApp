import { Container, Group, Paper } from "@mantine/core";
import { ChatCircleTextIcon } from "@phosphor-icons/react";
import { createFileRoute } from "@tanstack/react-router";
import { type ReactNode } from "react";
import {
    FeedbackSource,
    FeedbackTopic
} from "@backend/features/feedback/contract";
import { AppTitle } from "../components/app-title";
import { SettingsControls } from "../components/app-navbar";
import { FeedbackForm } from "../features/feedback/components/feedback-form";
import { IconSize } from "../lib/style-constants";
import styles from "../lib/styles.module.css";
import { m } from "../paraglide/messages";

/** Where feedback.frcdesign.org redirects: the form, for someone outside Onshape. */
export const Route = createFileRoute("/feedback")({
    component: FeedbackPage
});

const PAGE_WIDTH = 540;

function FeedbackPage(): ReactNode {
    return (
        <Container size={PAGE_WIDTH} py="xl">
            <Paper withBorder>
                <Group
                    justify="space-between"
                    p="sm"
                    wrap="nowrap"
                    className={styles.dividerBottom}
                >
                    <AppTitle
                        title={m.feedbackFormTitle()}
                        icon={<ChatCircleTextIcon size={IconSize.MEDIUM} />}
                    />
                    <SettingsControls />
                </Group>
                <FeedbackForm
                    initialTopic={FeedbackTopic.APP}
                    source={FeedbackSource.GENERAL}
                    onPage
                />
            </Paper>
        </Container>
    );
}
