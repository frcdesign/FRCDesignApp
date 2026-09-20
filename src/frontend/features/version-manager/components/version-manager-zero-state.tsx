import {
    Box,
    Card,
    Paper,
    Radio,
    SimpleGrid,
    Stack,
    Text
} from "@mantine/core";
import {
    ArrowLineDownIcon,
    ArrowLineUpIcon,
    TreeStructureIcon
} from "@phosphor-icons/react";
import { useState, type ReactNode } from "react";
import {
    LinkDirection,
    type WorkspacePath
} from "@backend/features/version-manager/contract";
import { AppIcon } from "../../../components/app-icon";
import { PageNotice, SectionNotice } from "../../../components/app-zero-state";
import {
    BORDER,
    FontWeight,
    IconSize,
    PrimaryColor,
    RADIUS,
    StatusColor
} from "../../../lib/style-constants";
import { AddLinkField } from "./add-link-input";

/**
 * What each direction is called, what picking it would mean, and the arrow that
 * runs it: down for what this document pulls in, up for what it pushes out.
 */
const DIRECTION_CHOICE = {
    [LinkDirection.PARENT]: {
        label: "A parent",
        icon: ArrowLineDownIcon,
        description: (documentName: string) =>
            `I want to pull changes from the linked document into ${documentName}.`
    },
    [LinkDirection.CHILD]: {
        label: "A child",
        icon: ArrowLineUpIcon,
        description: (documentName: string) =>
            `I want to push changes from ${documentName} to the linked document.`
    }
} as const;

/** What the copy calls this document when Onshape has not named it. */
const THIS_DOCUMENT = "this document";

interface VersionManagerZeroStateProps {
    workspace: WorkspacePath;
    /** What Onshape calls the open document; see {@link THIS_DOCUMENT}. */
    documentName?: string;
}

/**
 * What the page is before anything is linked: nothing to push, nothing to pull,
 * and two empty lists would say neither what this is for nor what to do about
 * it. The field is here rather than in the lists below, because linking one
 * document is the whole of getting started.
 */
export function VersionManagerZeroState(
    props: VersionManagerZeroStateProps
): ReactNode {
    return (
        <PageNotice
            icon={
                <AppIcon
                    icon={TreeStructureIcon}
                    size={IconSize.PAGE}
                    color={PrimaryColor.FILLED}
                />
            }
            title="Welcome to Version Manager!"
            description="Version manager lets you automatically push and pull versions between Onshape documents. To get started, paste the link of another associated Onshape document."
            action={
                <Stack align="center" gap="lg">
                    <LinkExampleDiagram />
                    <AddFirstLinkCard
                        workspace={props.workspace}
                        documentName={props.documentName ?? THIS_DOCUMENT}
                    />
                </Stack>
            }
        />
    );
}

interface AddFirstLinkCardProps {
    workspace: WorkspacePath;
    documentName: string;
}

/**
 * Linking a document is two answers — which way round it goes, and which
 * document — so they are asked together, in one card, in that order.
 */
function AddFirstLinkCard(props: AddFirstLinkCardProps): ReactNode {
    const { workspace, documentName } = props;
    // A parent by default, which is the document the welcome text describes:
    // one this document already uses.
    const [direction, setDirection] = useState<LinkDirection>(
        LinkDirection.PARENT
    );

    return (
        // Left, where the notice above it is centred: this is a form, and a
        // centred label over a field reads as a heading for the whole card.
        <Card withBorder maw={CARD_WIDTH} radius="md" ta="left">
            <Stack gap="md">
                <Radio.Group
                    value={direction}
                    onChange={setDirection}
                    label="The document I'm linking to is..."
                >
                    <SimpleGrid cols={2} spacing="xs" mt={6}>
                        <DirectionCard
                            direction={LinkDirection.PARENT}
                            selected={direction === LinkDirection.PARENT}
                            documentName={documentName}
                        />
                        <DirectionCard
                            direction={LinkDirection.CHILD}
                            selected={direction === LinkDirection.CHILD}
                            documentName={documentName}
                        />
                    </SimpleGrid>
                </Radio.Group>
                <AddLinkField workspace={workspace} direction={direction} />
            </Stack>
        </Card>
    );
}

/**
 * How wide the picture and the card get before they stop. The panel is narrower
 * than this, so it only bites in a browser — where a form spanning the window
 * reads as the page rather than as one thing to fill in.
 */
const CARD_WIDTH = 600;

/** Mantine's card carries the border; what being picked looks like is ours. */
const SELECTED_CARD = {
    borderColor: PrimaryColor.FILLED,
    backgroundColor: "var(--mantine-primary-color-light)"
};

interface DirectionCardProps {
    direction: LinkDirection;
    selected: boolean;
    documentName: string;
}

/**
 * One of the two things the pasted document can be. Both descriptions stay on
 * the page rather than swapping with the choice: which one is wanted is the
 * question, and it cannot be answered by the half of the answer showing.
 */
function DirectionCard(props: DirectionCardProps): ReactNode {
    const { direction, selected, documentName } = props;
    const choice = DIRECTION_CHOICE[direction];

    return (
        // A grid of one, so the notice fills the card rather than sitting in
        // the middle of it: Radio.Card is a button, and a button centres its
        // content in whatever height the taller card gives the row.
        <Radio.Card
            withBorder
            display="grid"
            px="sm"
            radius="sm"
            value={direction}
            style={selected ? SELECTED_CARD : undefined}
        >
            <SectionNotice
                align="left"
                py={12}
                icon={
                    <AppIcon
                        icon={choice.icon}
                        size={IconSize.SECTION}
                        color={PrimaryColor.FILLED}
                    />
                }
                title={choice.label}
                description={choice.description(documentName)}
            />
        </Radio.Card>
    );
}

/**
 * The picture's documents: a robot assembled from three subsystems, each in a
 * document of its own, which is the arrangement version manager is for.
 */
const EXAMPLE_PARENTS = [
    "Intake document",
    "Drivetrain document",
    "Shooter document"
];
const EXAMPLE_CHILD = "Robot document";

/**
 * The middle of an outer column, as a share of the diagram's width. The
 * connector is drawn across the whole diagram rather than inside the grid, so
 * it has to be told where the columns it joins are.
 */
const OUTER_COLUMN_CENTER = `${100 / 6}%`;

/**
 * The room between two documents. It is padding inside the columns rather than
 * a gap between them, so the columns stay exact thirds of the diagram and the
 * connector can be positioned against them; the rows then hang the same amount
 * outside it, to line the outer documents up with the card below.
 */
const COLUMN_GUTTER = 10;

/** How far the connector drops before it turns in, and how far after. */
const ELBOW_HEIGHT = 16;
const TRUNK_HEIGHT = 18;

const ARROW_WIDTH = 9;
const ARROW_HEIGHT = 7;

/** The color {@link BORDER} draws in, for the arrowhead, which is a filled
 * triangle rather than a rule. */
const LINE_COLOR = "var(--mantine-color-default-border)";

/**
 * What a link is, drawn: three subsystem documents, and the robot document that
 * uses all three. Which way round a pair of documents goes is the thing to have
 * right before pasting one in, and a picture says it in less room than the
 * paragraph it would take.
 */
function LinkExampleDiagram(): ReactNode {
    return (
        // The labels are outside the rows rather than beside the arrow, which
        // is where they would break the line they are labelling.
        <Stack gap={8} w="100%" maw={CARD_WIDTH} mx={-COLUMN_GUTTER}>
            <SimpleGrid cols={3} spacing={0}>
                {EXAMPLE_PARENTS.map((name) => (
                    <ExampleDocument key={name} name={name} />
                ))}
            </SimpleGrid>
            <DiagramLabel>Parents</DiagramLabel>
            <Connector />
            <DiagramLabel>Child</DiagramLabel>
            <SimpleGrid cols={3} spacing={0}>
                {/* The middle column, so the robot is the width of one of the
                    documents above it rather than of all three. */}
                <Box style={{ gridColumnStart: 2 }}>
                    <ExampleDocument name={EXAMPLE_CHILD} />
                </Box>
            </SimpleGrid>
        </Stack>
    );
}

interface ExampleDocumentProps {
    name: string;
}

/** One document in the picture; all four boxes are the same box. */
function ExampleDocument(props: ExampleDocumentProps): ReactNode {
    return (
        <Box px={COLUMN_GUTTER}>
            <Paper withBorder radius="sm" py={6} px="sm">
                <Text size="sm" fw={FontWeight.SEMI_BOLD} ta="center" truncate>
                    {props.name}
                </Text>
            </Paper>
        </Box>
    );
}

interface DiagramLabelProps {
    children: string;
}

/** Which end of a link the row it sits against is. Set as a label rather
 * than as prose, so it does not read as another line of the welcome text. */
function DiagramLabel(props: DiagramLabelProps): ReactNode {
    return (
        <Text
            size="xs"
            lh={1}
            fw={FontWeight.BOLD}
            c={StatusColor.DIMMED}
            ta="center"
        >
            {props.children}
        </Text>
    );
}

/**
 * The bracket under the three documents: each drops, turns in, and meets the
 * one line that carries the arrow down to the child.
 *
 * The arrowhead is a box with no size of its own and three borders — the usual
 * CSS triangle. Its point lands exactly where the line stops, which an icon,
 * padded inside its own box, would only land near.
 */
function Connector(): ReactNode {
    return (
        <Box pos="relative" h={ELBOW_HEIGHT + TRUNK_HEIGHT}>
            <Box
                pos="absolute"
                top={0}
                h={ELBOW_HEIGHT}
                left={OUTER_COLUMN_CENTER}
                right="50%"
                style={{
                    borderLeft: BORDER,
                    borderBottom: BORDER,
                    borderBottomLeftRadius: RADIUS
                }}
            />
            <Box
                pos="absolute"
                top={0}
                h={ELBOW_HEIGHT}
                left="50%"
                right={OUTER_COLUMN_CENTER}
                style={{
                    borderRight: BORDER,
                    borderBottom: BORDER,
                    borderBottomRightRadius: RADIUS
                }}
            />
            {/* The middle document's own drop, which carries straight on
                through the bracket and down to the arrow. */}
            <Box
                pos="absolute"
                top={0}
                bottom={0}
                left="50%"
                style={{ borderLeft: BORDER, transform: "translateX(-50%)" }}
            />
            <Box
                pos="absolute"
                bottom={0}
                left="50%"
                style={{
                    width: 0,
                    height: 0,
                    borderLeft: `${ARROW_WIDTH / 2}px solid transparent`,
                    borderRight: `${ARROW_WIDTH / 2}px solid transparent`,
                    borderTop: `${ARROW_HEIGHT}px solid ${LINE_COLOR}`,
                    transform: "translateX(-50%)"
                }}
            />
        </Box>
    );
}
