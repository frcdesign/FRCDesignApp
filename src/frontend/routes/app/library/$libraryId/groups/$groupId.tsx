import { useAccessData } from "../../../../../features/auth/access-level";
import { AppTitle } from "../../../../../components/app-title";
import {
    createFileRoute,
    Outlet,
    useNavigate,
    useParams
} from "@tanstack/react-router";
import { Box, Button, Group, Skeleton } from "@mantine/core";
import { ArrowLeft, ArrowUUpLeft, Warning } from "@phosphor-icons/react";
import {
    BORDER,
    IconSize,
    SECTION_HEADER_HEIGHT
} from "../../../../../lib/style-constants";
import { PropsWithChildren, ReactNode } from "react";
import { SearchResults } from "../../../../../features/search/components/search-results";
import { GroupOut, Insertables } from "@backend/features/library/contract";
import { hasEditorAccess } from "@backend/features/auth/access-level";
import { filterInsertables } from "../../../../../features/search/filter";
import { GroupMenuItems } from "../../../../../features/library/components/group-card";
import { InsertableCard } from "../../../../../features/library/components/insertable-card";
import { ItemTable } from "../../../../../features/library/components/card-components";
import { AppContextMenu, MenuButton } from "../../../../../components/app-menu";
import { SearchCallout } from "../../../../../features/search/components/search-errors";
import {
    PageError,
    SectionError,
    SectionLoading
} from "../../../../../components/app-zero-state";
import { ClearFiltersButton } from "../../../../../features/settings/components/vendor-filters";
import { useLibraryQuery } from "../../../../../features/library/queries";
import { useLibraryId } from "../../../../../features/library/library-path";
import { useUiState, updateUiState } from "../../../../../lib/ui-state";

export const Route = createFileRoute("/app/library/$libraryId/groups/$groupId")(
    {
        component: GroupList,
        onEnter: (match) => {
            updateUiState({ openGroupId: match.params.groupId });
        }
    }
);

function GroupList(): ReactNode {
    const navigate = useNavigate();
    const libraryQuery = useLibraryQuery();
    const { libraryId, groupId } = useParams({
        from: "/app/library/$libraryId/groups/$groupId"
    });

    const uiState = useUiState()[0];

    if (libraryQuery.isPending) {
        return (
            <GroupZeroState>
                <SectionLoading title="Loading group..." />
            </GroupZeroState>
        );
    } else if (libraryQuery.isError) {
        return (
            <GroupZeroState>
                <SectionError title="Failed to load group." />
            </GroupZeroState>
        );
    }
    const groups = libraryQuery.data.groups;
    const insertables = libraryQuery.data.insertables;

    const group = groups[groupId];

    if (!group) {
        return (
            <PageError
                title="Group not found"
                description={null}
                justifyUp
                action={
                    <Button
                        leftSection={<ArrowUUpLeft size={IconSize.SMALL} />}
                        onClick={() => {
                            void navigate({
                                to: "/app/library/$libraryId",
                                params: { libraryId }
                            });
                        }}
                    >
                        Go back
                    </Button>
                }
            />
        );
    }

    let content: ReactNode;
    if (uiState.searchQuery) {
        content = (
            <SearchResults
                query={uiState.searchQuery}
                filters={{
                    vendors: uiState.vendorFilters,
                    groupId: group.id
                }}
            />
        );
    } else {
        content = <GroupListContent group={group} insertables={insertables} />;
    }

    return (
        <>
            <GroupHeaderRow group={group} />
            <Box style={{ borderBottom: BORDER }}>
                {content}
                <Outlet />
            </Box>
        </>
    );
}

/**
 * The page's frame around a state that has no group to show yet, so the header
 * (and its way back) is up before the data it names lands.
 */
function GroupZeroState({ children }: PropsWithChildren): ReactNode {
    return (
        <>
            <GroupHeaderRow />
            <Box style={{ borderBottom: BORDER }}>{children}</Box>
        </>
    );
}

/** Roughly a group name, so the skeleton doesn't resize the row when it lands. */
const TITLE_SKELETON_WIDTH = 160;
const TITLE_SKELETON_HEIGHT = 14;

/** The group is absent until the library data it comes from has loaded. */
function GroupHeaderRow({ group }: { group?: GroupOut }): ReactNode {
    const navigate = useNavigate();
    const libraryId = useLibraryId();
    const menuItems = group ? <GroupMenuItems group={group} /> : undefined;

    const header = (
        <Box
            className="interactive"
            onClick={() =>
                void navigate({
                    to: "/app/library/$libraryId",
                    params: { libraryId }
                })
            }
            px="md"
            h={SECTION_HEADER_HEIGHT}
            // Owned here, as an accordion control owns its own, so the row and
            // its divider measure the same as a section header's.
            style={{ borderBottom: BORDER }}
        >
            <Group wrap="nowrap" justify="space-between" h="100%">
                <AppTitle
                    icon={<ArrowLeft size={IconSize.MEDIUM} />}
                    title={
                        group?.name ?? (
                            <Skeleton
                                // A span: the title renders it inside a <p>.
                                component="span"
                                display="inline-block"
                                w={TITLE_SKELETON_WIDTH}
                                h={TITLE_SKELETON_HEIGHT}
                            />
                        )
                    }
                />
                {menuItems && <MenuButton>{menuItems}</MenuButton>}
            </Group>
        </Box>
    );

    // Nothing to act on until the group lands, so no context menu yet.
    if (!menuItems) {
        return header;
    }
    return <AppContextMenu menuItems={menuItems}>{header}</AppContextMenu>;
}

interface GroupListCardsProps {
    group: GroupOut;
    insertables: Insertables;
}

export function GroupListContent(props: GroupListCardsProps): ReactNode {
    const { group, insertables } = props;

    const accessData = useAccessData();
    const uiState = useUiState()[0];

    const groupInsertables = group.insertableOrder
        .map((insertableId) => insertables[insertableId])
        .filter((insertable) => !!insertable);

    if (groupInsertables.length === 0) {
        return group.isLoaded ? (
            <SectionError
                title="This group has no visible elements"
                description={null}
            />
        ) : (
            <SectionError
                title="This group failed to load."
                description="Reload documents to try again, or delete the group."
            />
        );
    }

    const filterResult = filterInsertables(groupInsertables, {
        vendors: uiState.vendorFilters,
        isVisible: !hasEditorAccess(accessData.currentAccessLevel)
    });

    if (filterResult.insertables.length === 0) {
        return (
            <SectionError
                icon={
                    <Box
                        component={Warning}
                        size={IconSize.SECTION}
                        c="yellow"
                    />
                }
                title="All elements are hidden by filters"
                action={<ClearFiltersButton />}
            />
        );
    }

    const insertableCards = filterResult.insertables.map((insertable) => (
        <InsertableCard key={insertable.id} insertable={insertable} />
    ));

    const callout = (
        <SearchCallout objectLabel="element" filtered={filterResult.filtered} />
    );

    return (
        <>
            {callout}
            <ItemTable>{insertableCards}</ItemTable>
        </>
    );
}
