import { Group, Stack, Text, UnstyledButton } from "@mantine/core";
import { ArrowRightIcon, BookOpenTextIcon } from "@phosphor-icons/react";
import { useNavigate } from "@tanstack/react-router";
import { ReactNode } from "react";
import { LibraryId } from "@backend/features/library/library-id";
import { AppIcon } from "../../../components/app-icon";
import { PageNotice } from "../../../components/app-zero-state";
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
        name: "FRC®",
        fullName: "FIRST® Robotics Competition"
    },
    {
        libraryId: LibraryId.FTC_DESIGN_LIB,
        name: "FTC®",
        fullName: "FIRST® Tech Challenge"
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
                <Stack gap={2} flex={1} miw={0} ta="left">
                    {/* The library's own color, so the two choices read as the
                        two apps they open rather than one list. */}
                    <Text
                        size="xl"
                        fw={FontWeight.BOLD}
                        c={getLibraryShade(libraryId)}
                    >
                        {name}
                    </Text>
                    <Text size="sm">{getLibraryName(libraryId)}</Text>
                    <Text size="xs" c={StatusColor.DIMMED}>
                        {fullName}
                    </Text>
                </Stack>
                <ArrowRightIcon size={IconSize.MEDIUM} />
            </Group>
        </UnstyledButton>
    );
}

/**
 * What a new user sees in place of a library: which program they build for,
 * which picks the library the app opens in from then on. The answer is stored
 * like any other synced setting, so it is asked once per account rather than
 * once per browser — and the navbar's tabs answer it too, being the same choice.
 */
export function ProgramSelect(): ReactNode {
    const navigate = useNavigate();

    const selectProgram = (libraryId: LibraryId) => {
        updateUiState({ libraryId, libraryChosen: true });
        void navigate({ to: "/app/library/$libraryId", params: { libraryId } });
    };

    return (
        <PageNotice
            icon={<AppIcon icon={BookOpenTextIcon} size={IconSize.PAGE} />}
            title="Welcome to the FRCDesignApp!"
            description="To get started, select your library. You can switch between libraries at any time using the top navbar."
            action={
                // Stacked and full width: two side by side would each be
                // narrower than their own name in Onshape's panel.
                <Stack gap="sm" w="100%" maw={320}>
                    {PROGRAMS.map((program) => (
                        <ProgramCard
                            key={program.libraryId}
                            program={program}
                            onSelect={selectProgram}
                        />
                    ))}
                </Stack>
            }
        />
    );
}

/** Whether the app still has to ask which library the caller wants. */
export function useNeedsProgram(): boolean {
    return !useGetUiState().libraryChosen;
}
