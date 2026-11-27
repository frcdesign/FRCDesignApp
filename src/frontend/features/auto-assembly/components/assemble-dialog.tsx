import { Button, Checkbox, Group, Stack, Text, Tooltip } from "@mantine/core";
import { PuzzlePieceIcon } from "@phosphor-icons/react";
import { type ReactNode, useState } from "react";
import {
    type DeclaredPart,
    DeclaredPartStatus
} from "@backend/features/auto-assembly/contract";
import { type ElementPath } from "@backend/lib/onshape/path";
import { AppIcon } from "../../../components/app-icon";
import { AppModalBody, AppModalFooter } from "../../../components/app-modal";
import {
    SectionError,
    SectionLoading,
    SectionNotice
} from "../../../components/app-notice";
import { useAppModal } from "../../../components/open-app-modal";
import { sendHighlightMessage, showFocused } from "../../../lib/messages";
import { useTargetElement } from "../../../lib/onshape-params";
import { Status, STATUS_COLOR } from "../../../lib/status";
import { IconSize, PrimaryColor } from "../../../lib/style-constants";
import { m } from "../../../paraglide/messages";
import { useAssembleDeclaredMutation, useDeclaredPartsQuery } from "../queries";

interface AssembleDialogProps {
    assembly: ElementPath;
}

/**
 * The parts the assembly's FeatureScripts declared, each to place or leave
 * out, and to flip to the other side of its hole; then a run placing them.
 */
export function AssembleDialog(props: AssembleDialogProps): ReactNode {
    const { assembly } = props;
    const query = useDeclaredPartsQuery(assembly);
    const assembleMutation = useAssembleDeclaredMutation(assembly);
    const modal = useAppModal();
    const [left, setLeft] = useState<ReadonlySet<string>>(() => new Set());
    const [flipped, setFlipped] = useState<ReadonlySet<string>>(
        () => new Set()
    );

    if (query.isPending) {
        return (
            <AppModalBody>
                <SectionLoading title={m.autoAssemblyTaskFindRunning()} />
            </AppModalBody>
        );
    }
    if (query.isError) {
        return (
            <AppModalBody>
                <SectionError
                    title={m.autoAssemblyFindPartsFailed()}
                    error={query.error}
                />
            </AppModalBody>
        );
    }
    const { parts } = query.data;
    if (parts.length === 0) {
        return (
            <AppModalBody>
                <SectionNotice
                    icon={
                        <AppIcon
                            icon={PuzzlePieceIcon}
                            size={IconSize.PAGE}
                            color={PrimaryColor.FILLED}
                        />
                    }
                    title={m.autoAssemblyNoDeclaredPartsTitle()}
                    description={m.autoAssemblyNoDeclaredPartsDescription()}
                />
            </AppModalBody>
        );
    }

    const chosen = parts.filter(
        (part) =>
            part.status === DeclaredPartStatus.READY && !left.has(part.key)
    );
    const toggle =
        (set: ReadonlySet<string>, update: (next: Set<string>) => void) =>
        (key: string) => {
            const next = new Set(set);
            if (!next.delete(key)) {
                next.add(key);
            }
            update(next);
        };

    const assemble = () =>
        assembleMutation.mutate(
            {
                parts: chosen.map((part) => part.key),
                flipped: chosen
                    .filter((part) => flipped.has(part.key))
                    .map((part) => part.key)
            },
            { onSuccess: modal.close }
        );

    return (
        <>
            <AppModalBody>
                <DeclaredPartRows
                    parts={parts}
                    left={left}
                    flipped={flipped}
                    onToggleLeft={toggle(left, setLeft)}
                    onToggleFlipped={toggle(flipped, setFlipped)}
                />
            </AppModalBody>
            <AppModalFooter>
                <Button variant="default" onClick={modal.close}>
                    {m.autoAssemblyAssembleCancel()}
                </Button>
                <Button
                    disabled={chosen.length === 0}
                    loading={assembleMutation.isPending}
                    onClick={assemble}
                >
                    {m.autoAssemblyAssemble({ count: chosen.length })}
                </Button>
            </AppModalFooter>
        </>
    );
}

interface DeclaredPartRowsProps {
    parts: DeclaredPart[];
    left: ReadonlySet<string>;
    flipped: ReadonlySet<string>;
    onToggleLeft: (key: string) => void;
    onToggleFlipped: (key: string) => void;
}

/** Hovering a part lights up the part it goes on. */
function DeclaredPartRows(props: DeclaredPartRowsProps): ReactNode {
    const { parts, left, flipped, onToggleLeft, onToggleFlipped } = props;
    const target = useTargetElement();
    const show = (part: DeclaredPart) => {
        if (target) {
            sendHighlightMessage(target, [{ occurrencePath: part.hostPath }]);
        }
    };
    const leave = () => {
        if (target) {
            showFocused(target);
        }
    };

    return (
        <Stack gap="sm" onMouseLeave={leave}>
            {parts.map((part) => {
                const isReady = part.status === DeclaredPartStatus.READY;
                const isChosen = isReady && !left.has(part.key);
                return (
                    <Group
                        key={part.key}
                        justify="space-between"
                        wrap="nowrap"
                        align="flex-start"
                        onMouseEnter={() => show(part)}
                    >
                        <Checkbox
                            label={part.name}
                            description={<PartNote part={part} />}
                            checked={isChosen}
                            disabled={!isReady}
                            onChange={() => onToggleLeft(part.key)}
                        />
                        {isReady && part.canFlip && (
                            <Tooltip label={m.autoAssemblyFlipDescription()}>
                                <Checkbox
                                    size="xs"
                                    label={m.autoAssemblyFlip()}
                                    checked={flipped.has(part.key)}
                                    disabled={!isChosen}
                                    onChange={() => onToggleFlipped(part.key)}
                                />
                            </Tooltip>
                        )}
                    </Group>
                );
            })}
        </Stack>
    );
}

interface PartNoteProps {
    part: DeclaredPart;
}

/** Why a part can't be chosen: it's placed already, or can't be placed. */
function PartNote(props: PartNoteProps): ReactNode {
    const { part } = props;
    switch (part.status) {
        case DeclaredPartStatus.READY:
            return null;
        case DeclaredPartStatus.PLACED:
            return m.autoAssemblyPartPlaced();
        case DeclaredPartStatus.UNPLACEABLE:
            return (
                <Text span inherit c={STATUS_COLOR[Status.ERROR]}>
                    {part.reason}
                </Text>
            );
    }
}
