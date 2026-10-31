import { Button, Group, Text } from "@mantine/core";
import { ArrowSquareOutIcon, DiscordLogoIcon } from "@phosphor-icons/react";
import { type ReactNode } from "react";
import { type FeedbackOut } from "@backend/features/feedback/contract";
import { AppModalBody, AppModalFooter } from "../../../components/app-modal";
import { Callout } from "../../../components/callout";
import { Status } from "../../../lib/status";
import { DISCORD_INVITE_URL, openUrlInNewTab } from "../../../lib/url";

interface ReportSentProps {
    sent: FeedbackOut;
    onClose: () => void;
}

/** Where the conversation goes on: replies happen only in the report's Discord thread. */
export function ReportSent(props: ReportSentProps): ReactNode {
    const { sent, onClose } = props;
    return (
        <>
            <AppModalBody>
                <Callout
                    status={Status.SUCCESS}
                    text="Report sent. Thank you!"
                />
                <Text>
                    The team answers in your report&apos;s thread in the
                    FRCDesign Discord. Join the server first if you aren&apos;t
                    a member, then open the thread to follow along or add
                    details.
                </Text>
                <Group gap="sm" wrap="wrap">
                    <Button
                        variant="default"
                        leftSection={<DiscordLogoIcon />}
                        onClick={() => openUrlInNewTab(DISCORD_INVITE_URL)}
                    >
                        Join the Discord
                    </Button>
                    {sent.threadUrl && (
                        <Button
                            leftSection={<ArrowSquareOutIcon />}
                            onClick={() => {
                                if (sent.threadUrl) {
                                    openUrlInNewTab(sent.threadUrl);
                                }
                            }}
                        >
                            Open the thread
                        </Button>
                    )}
                </Group>
            </AppModalBody>
            <AppModalFooter>
                <Button onClick={onClose}>Close</Button>
            </AppModalFooter>
        </>
    );
}
