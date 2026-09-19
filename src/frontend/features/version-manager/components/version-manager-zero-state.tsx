import { Card, Divider, Radio, SimpleGrid, Stack } from "@mantine/core";
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
import { IconSize, PrimaryColor } from "../../../lib/style-constants";
import { AddLinkField } from "./add-link-input";

/**
 * What each direction is called, what picking it would mean, and the arrow that
 * runs it: down for what this document pulls in, up for what it pushes out.
 */
const DIRECTION_CHOICE = {
    [LinkDirection.PARENT]: {
        label: "A parent",
        icon: ArrowLineDownIcon,
        description:
            "A parent is a document this one uses. You pull its latest versions in."
    },
    [LinkDirection.CHILD]: {
        label: "A child",
        icon: ArrowLineUpIcon,
        description:
            "A child is a document that uses this one. You push versions of this document out to it."
    }
} as const;

interface VersionManagerZeroStateProps {
    workspace: WorkspacePath;
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
            justifyUp
            icon={
                <AppIcon
                    icon={TreeStructureIcon}
                    size={IconSize.PAGE}
                    color={PrimaryColor.FILLED}
                />
            }
            title="Welcome to Version Manager!"
            description="Version manager lets you automatically push and pull versions between Onshape documents. To get started, paste the link to another Onshape document you use."
            action={<AddFirstLinkCard workspace={props.workspace} />}
        />
    );
}

interface AddFirstLinkCardProps {
    workspace: WorkspacePath;
}

/**
 * Linking a document is two answers — which way round it goes, and which
 * document — so they are asked together, in one card, in that order.
 */
function AddFirstLinkCard(props: AddFirstLinkCardProps): ReactNode {
    const { workspace } = props;
    // A parent by default, which is the document the welcome text describes:
    // one this document already uses.
    const [direction, setDirection] = useState<LinkDirection>(
        LinkDirection.PARENT
    );

    return (
        // Left, where the notice above it is centred: this is a form, and a
        // centred label over a field reads as a heading for the whole card.
        <Card withBorder w="100%" maw={CARD_WIDTH} p="md" radius="md" ta="left">
            <Stack gap="md">
                <Radio.Group
                    value={direction}
                    onChange={setDirection}
                    label="This document is linked as"
                >
                    <SimpleGrid cols={2} spacing="xs" mt={6}>
                        <DirectionCard
                            direction={LinkDirection.PARENT}
                            selected={direction === LinkDirection.PARENT}
                        />
                        <DirectionCard
                            direction={LinkDirection.CHILD}
                            selected={direction === LinkDirection.CHILD}
                        />
                    </SimpleGrid>
                </Radio.Group>
                <Divider />
                <AddLinkField workspace={workspace} direction={direction} />
            </Stack>
        </Card>
    );
}

/**
 * How wide the card gets before it stops. The panel is narrower than this, so
 * it only bites in a browser — where a form spanning the window reads as the
 * page rather than as one thing to fill in.
 */
const CARD_WIDTH = 480;

/** Mantine's card carries the border; what being picked looks like is ours. */
const SELECTED_CARD = {
    borderColor: PrimaryColor.FILLED,
    backgroundColor: "var(--mantine-primary-color-light)"
};

interface DirectionCardProps {
    direction: LinkDirection;
    selected: boolean;
}

/**
 * One of the two things the pasted document can be. Both descriptions stay on
 * the page rather than swapping with the choice: which one is wanted is the
 * question, and it cannot be answered by the half of the answer showing.
 */
function DirectionCard(props: DirectionCardProps): ReactNode {
    const { direction, selected } = props;
    const choice = DIRECTION_CHOICE[direction];

    return (
        <Radio.Card
            withBorder
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
                description={choice.description}
            />
        </Radio.Card>
    );
}
