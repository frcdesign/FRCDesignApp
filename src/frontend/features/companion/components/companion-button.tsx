import { ActionIcon, Tooltip } from "@mantine/core";
import { PuzzlePieceIcon } from "@phosphor-icons/react";
import { type ReactNode } from "react";
import { BadgedIcon } from "../../../components/badged-icon";
import { Status } from "../../../lib/status";
import { COMPANION_URL, openUrlInNewTab } from "../../../lib/url";
import { m } from "../../../paraglide/messages";
import { useCanUseCompanion, useCompanion } from "../connection";

/** Beside the theme toggle: gets the Companion, or says it's connected. Inside Onshape, in a browser that can install it. */
export function CompanionButton(): ReactNode {
    const canUse = useCanUseCompanion();
    const isConnected = useCompanion((state) => state.isConnected);

    if (!canUse) {
        return null;
    }
    return (
        <Tooltip
            label={isConnected ? m.companionConnected() : m.companionGet()}
            position="bottom"
        >
            <ActionIcon
                my="auto"
                size="input-sm"
                onClick={
                    isConnected
                        ? undefined
                        : () => openUrlInNewTab(COMPANION_URL)
                }
            >
                <BadgedIcon
                    icon={PuzzlePieceIcon}
                    status={isConnected ? Status.SUCCESS : Status.INFO}
                />
            </ActionIcon>
        </Tooltip>
    );
}
