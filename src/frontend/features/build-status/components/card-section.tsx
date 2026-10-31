import { Divider } from "@mantine/core";
import { ReactNode } from "react";
import { CollapsibleSection } from "../../../components/section";
import { getUiState, updateUiState, useUiState } from "../../../lib/ui-state";
import { CardSectionId } from "../card-section-id";

/** The parameter list is long and wanted less often, so it starts closed. */
const OPEN_BY_DEFAULT: Record<CardSectionId, boolean> = {
    [CardSectionId.BUILD_CHECKS]: true,
    [CardSectionId.SETTINGS]: true,
    [CardSectionId.CONFIGURATION]: false,
    [CardSectionId.USAGE]: true
};

interface CardSectionProps {
    id: CardSectionId;
    title: string;
    actions?: ReactNode;
    children: ReactNode;
}

/** Open or closed on every card at once, and remembered, since an editor checks many in a row. */
export function CardSection(props: CardSectionProps): ReactNode {
    const { id, title, actions, children } = props;
    const stored = useUiState((state) => state.cardSections[id]);
    const opened = stored ?? OPEN_BY_DEFAULT[id];

    const toggle = () =>
        updateUiState({
            cardSections: { ...getUiState().cardSections, [id]: !opened }
        });

    return (
        <>
            <Divider />
            <CollapsibleSection
                title={title}
                opened={opened}
                onToggle={toggle}
                actions={actions}
            >
                {children}
            </CollapsibleSection>
        </>
    );
}
