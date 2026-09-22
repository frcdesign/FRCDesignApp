import { Group, Modal, Stack, Text, UnstyledButton } from "@mantine/core";
import { ArrowRightIcon } from "@phosphor-icons/react";
import { useNavigate } from "@tanstack/react-router";
import { ReactNode } from "react";
import { LibraryId } from "@backend/features/library/library-id";
import {
    BORDER,
    FontWeight,
    IconSize,
    RADIUS,
    StatusColor
} from "../../../lib/style-constants";
import { getLibraryName } from "../../../lib/library";
import { getLibraryShade } from "../../../theme";
import { updateUiState, useGetUiState } from "../../../lib/ui-state";

interface Program {
    libraryId: LibraryId;
    /** What a team calls the program it competes in. */
    name: string;
    fullName: string;
}

/** What the app is offered for. MKCad is deprecated, so nobody is started in it. */
const PROGRAMS: Program[] = [
    {
        libraryId: LibraryId.FRC_DESIGN_LIB,
        name: "FRC",
        fullName: "FIRST Robotics Competition"
    },
    {
        libraryId: LibraryId.FTC_DESIGN_LIB,
        name: "FTC",
        fullName: "FIRST Tech Challenge"
    }
];

interface ProgramCardProps {
    program: Program;
    onSelect: (libraryId: LibraryId) => void;
}

/** One program to pick, named the way its teams name it, over its library. */
function ProgramCard(props: ProgramCardProps): ReactNode {
    const { program, onSelect } = props;
    const { libraryId, name, fullName } = program;

    return (
        <UnstyledButton
            className="interactive"
            p="md"
            style={{ border: BORDER, borderRadius: RADIUS }}
            onClick={() => {
                onSelect(libraryId);
            }}
        >
            <Group gap="sm" wrap="nowrap">
                <Stack gap={2} flex={1} miw={0}>
                    {/* The library's own color, so the two choices read as the
                        two apps they open rather than one list. */}
                    <Text
                        size="xl"
                        fw={FontWeight.BOLD}
                        c={getLibraryShade(libraryId)}
                    >
                        {name}
                    </Text>
                    <Text size="sm">{fullName}</Text>
                    <Text size="xs" c={StatusColor.DIMMED}>
                        {getLibraryName(libraryId)}
                    </Text>
                </Stack>
                <ArrowRightIcon size={IconSize.MEDIUM} />
            </Group>
        </UnstyledButton>
    );
}

/**
 * The first thing a new user sees: which program they build for, which picks
 * the library the app opens in from then on. The answer is stored like any
 * other synced setting, so it is asked once per account rather than per browser.
 */
export function ProgramSelectModal(): ReactNode {
    const { libraryChosen } = useGetUiState();
    const navigate = useNavigate();

    const selectProgram = (libraryId: LibraryId) => {
        updateUiState({ libraryId, libraryChosen: true });
        void navigate({ to: "/app/library/$libraryId", params: { libraryId } });
    };

    return (
        <Modal
            opened={!libraryChosen}
            // Picking is the only way out, so a close has nothing to do.
            onClose={() => undefined}
            withCloseButton={false}
            closeOnClickOutside={false}
            closeOnEscape={false}
            centered
            size="md"
            padding="lg"
            title={
                <Stack gap={4}>
                    <Text size="xl" fw={FontWeight.BOLD}>
                        Choose your program
                    </Text>
                    <Text size="sm" c={StatusColor.DIMMED}>
                        It sets the library the app opens in. You can switch
                        between libraries at any time.
                    </Text>
                </Stack>
            }
            styles={{
                // Drawn like the app's other modals, which the manager frames.
                content: { border: BORDER },
                // The title is the modal's own content here, not a bar over it.
                header: { paddingBottom: 0 },
                title: { minWidth: 0 }
            }}
        >
            {/* Takes the focus the trap would otherwise land on the first
                program, which reads as that one being pre-selected. */}
            <Stack
                data-autofocus
                tabIndex={-1}
                style={{ outline: "none" }}
                gap="sm"
                mt="md"
            >
                {PROGRAMS.map((program) => (
                    <ProgramCard
                        key={program.libraryId}
                        program={program}
                        onSelect={selectProgram}
                    />
                ))}
            </Stack>
        </Modal>
    );
}
