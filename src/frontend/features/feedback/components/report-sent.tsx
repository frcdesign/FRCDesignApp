import { Button, Group, Text } from "@mantine/core";
import { DiscordLogoIcon } from "@phosphor-icons/react";
import { type ReactNode } from "react";
import { type FeedbackOut } from "@backend/features/feedback/contract";
import { AppModalBody, AppModalFooter } from "../../../components/app-modal";
import { Callout } from "../../../components/callout";
import { Status } from "../../../lib/status";
import { DISCORD_INVITE_URL, openUrlInNewTab } from "../../../lib/url";

interface ReportSentProps {
    sent: FeedbackOut;
    /** The thread's name, which is what to look for in the channel. */
    title: string;
    onClose: () => void;
}

/** Where the conversation goes on: replies happen only in the report's Discord thread. */
export function ReportSent(props: ReportSentProps): ReactNode {
    const { sent, title, onClose } = props;
    const { name, inviteUrl = DISCORD_INVITE_URL } = sent.forum;
    return (
        <>
            <AppModalBody>
                <Callout
                    status={Status.SUCCESS}
                    text="Report sent. Thank you!"
                />
                <Text>
                    It&apos;s posted as <b>{title}</b>
                    {name ? (
                        <>
                            {" "}
                            in <b>#{name}</b>
                        </>
                    ) : null}{" "}
                    in the FRCDesign Discord. The team answers there, so open it
                    to follow along or add details.
                </Text>
                <Group>
                    <Button
                        leftSection={<DiscordLogoIcon />}
                        onClick={() => openUrlInNewTab(inviteUrl)}
                    >
                        Open in Discord
                    </Button>
                </Group>
            </AppModalBody>
            <AppModalFooter>
                <Button variant="default" onClick={onClose}>
                    Close
                </Button>
            </AppModalFooter>
        </>
    );
}
