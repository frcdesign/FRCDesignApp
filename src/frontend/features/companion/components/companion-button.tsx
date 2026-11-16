import { ActionIcon, Tooltip } from "@mantine/core";
import { PuzzlePieceIcon } from "@phosphor-icons/react";
import { Hint } from "@backend/features/hints/contract";
import { type ReactNode } from "react";
import { DotIndicator } from "../../../components/dot-indicator";
import { IconSize, StatusColor } from "../../../lib/style-constants";
import { COMPANION_URL, openUrlInNewTab } from "../../../lib/url";
import { m } from "../../../paraglide/messages";
import { useHasSeenHint } from "../../hints/queries";
import { useCanUseCompanion, useCompanion } from "../connection";

/** In the navbar: gets the Companion, or says it's connected. Inside Onshape, in a browser that can install it. */
export function CompanionButton(): ReactNode {
    const canUse = useCanUseCompanion();
    const isConnected = useCompanion((state) => state.isConnected);
    const hasConnected = useHasSeenHint(Hint.CONNECTED_COMPANION);

    if (!canUse) {
        return null;
    }
    if (isConnected) {
        return (
            <Tooltip label={m.companionConnected()} position="bottom">
                <ActionIcon
                    my="auto"
                    size="input-sm"
                    variant="subtle"
                    color={StatusColor.SUCCESS}
                >
                    <PuzzlePieceIcon size={IconSize.CONTROL} weight="fill" />
                </ActionIcon>
            </Tooltip>
        );
    }
    return (
        <Tooltip label={m.companionGet()} position="bottom">
            <DotIndicator shown={!hasConnected} my="auto">
                <ActionIcon
                    size="input-sm"
                    onClick={() => openUrlInNewTab(COMPANION_URL)}
                >
                    <PuzzlePieceIcon size={IconSize.CONTROL} />
                </ActionIcon>
            </DotIndicator>
        </Tooltip>
    );
}
