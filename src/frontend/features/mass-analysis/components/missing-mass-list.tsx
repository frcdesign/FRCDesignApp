import { Card, Group, Stack, Text } from "@mantine/core";
import { type ReactNode } from "react";
import { Section } from "../../../components/section";
import { SectionNotice } from "../../../components/app-notice";
import { sendHighlightMessage, showFocused } from "../../../lib/messages";
import { useTargetElement } from "../../../lib/onshape-params";
import { StatusColor } from "../../../lib/style-constants";
import { m } from "../../../paraglide/messages";
import { type MissingPart } from "../mass-data";
import styles from "./missing-mass-list.module.css";

interface MissingMassListProps {
    missing: MissingPart[];
}

/** Hovering a part lights every instance of it up in Onshape. */
export function MissingMassList({ missing }: MissingMassListProps): ReactNode {
    const target = useTargetElement();

    const show = (entry: MissingPart): void => {
        if (target) {
            sendHighlightMessage(
                target,
                entry.occurrences.map((occurrencePath) => ({ occurrencePath }))
            );
        }
    };

    const leave = (): void => {
        if (target) {
            showFocused(target);
        }
    };

    return (
        <Section
            title={m.massAnalysisMissingTitle()}
            caption={
                missing.length > 0
                    ? m.massAnalysisMissingCaption({ count: missing.length })
                    : undefined
            }
        >
            {missing.length === 0 ? (
                <SectionNotice title={m.massAnalysisMissingNone()} />
            ) : (
                <Card p="xs">
                    <Stack gap={0} onMouseLeave={leave}>
                        {missing.map((entry) => (
                            <MissingPartRow
                                key={entry.part.partKey}
                                missing={entry}
                                onHover={() => show(entry)}
                            />
                        ))}
                    </Stack>
                </Card>
            )}
        </Section>
    );
}

interface MissingPartRowProps {
    missing: MissingPart;
    onHover: () => void;
}

function MissingPartRow({ missing, onHover }: MissingPartRowProps): ReactNode {
    const { part, count, within } = missing;
    return (
        <Group
            className={styles.row}
            justify="space-between"
            wrap="nowrap"
            px="xs"
            py={6}
            onMouseEnter={onHover}
        >
            <Stack gap={0} miw={0}>
                <Text truncate>{part.name}</Text>
                {within && (
                    <Text size="xs" c={StatusColor.DIMMED} truncate>
                        {within}
                    </Text>
                )}
            </Stack>
            <Text c={StatusColor.DIMMED}>
                {m.massAnalysisQuantity({ count })}
            </Text>
        </Group>
    );
}
