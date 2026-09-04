import { useAccessData } from "../../../../../features/auth/access-level";
import { AppTitle } from "../../../../../components/app-title";
import {
    createFileRoute,
    Outlet,
    useNavigate,
    useParams
} from "@tanstack/react-router";
import { Box, Button, Group } from "@mantine/core";
import {
    ArrowLeftIcon,
    ArrowUUpLeftIcon,
    WarningIcon
} from "@phosphor-icons/react";
import {
    BORDER,
    IconSize,
    SECTION_HEADER_HEIGHT,
    StatusColor
} from "../../../../../lib/style-constants";
import { ReactNode } from "react";
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
import { useGetUiState } from "../../../../../lib/ui-state";
import { rememberOpenGroup } from "../../../../../features/settings/settings";
import { AppIcon } from "../../../../../components/app-icon";

export const Route = createFileRoute("/app/library/$libraryId/groups/$groupId")(
    {
        component: GroupList,
        onEnter: (match) => {
            rememberOpenGroup(match.params.groupId);
        }
    }
);

function GroupList(): ReactNode {
    const navigate = useNavigate();
    const libraryQuery = useLibraryQuery();
    const { libraryId, groupId } = useParams({
        from: "/app/library/$libraryId/groups/$groupId"
    });

    const uiState = useGetUiState();

    if (libraryQuery.isPending) {
        return <SectionLoading title="Loading group..." />;
    } else if (libraryQuery.isError) {
        return <SectionError title="Failed to load group." />;
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
                        leftSection={<ArrowUUpLeftIcon size={IconSize.SMALL} />}
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

interface GroupHeaderRowProps {
    group: GroupOut;
}

function GroupHeaderRow(props: GroupHeaderRowProps): ReactNode {
    const { group } = props;
    const navigate = useNavigate();
    const libraryId = useLibraryId();
    const menuItems = <GroupMenuItems group={group} />;

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
                    icon={<ArrowLeftIcon size={IconSize.MEDIUM} />}
                    title={group.name}
                />
                <MenuButton>{menuItems}</MenuButton>
            </Group>
        </Box>
    );

    return <AppContextMenu menuItems={menuItems}>{header}</AppContextMenu>;
}

interface GroupListCardsProps {
    group: GroupOut;
    insertables: Insertables;
}

export function GroupListContent(props: GroupListCardsProps): ReactNode {
    const { group, insertables } = props;

    const accessData = useAccessData();
    const uiState = useGetUiState();

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

    const result = filterInsertables(groupInsertables, {
        vendors: uiState.vendorFilters,
        isVisible: !hasEditorAccess(accessData.currentAccessLevel)
    });

    if (result.insertables.length === 0) {
        return (
            <SectionError
                icon={
                    <AppIcon
                        icon={WarningIcon}
                        size={IconSize.SECTION}
                        color={StatusColor.WARNING}
                    />
                }
                title="All elements are hidden by filters"
                action={<ClearFiltersButton />}
            />
        );
    }

    const insertableCards = result.insertables.map((insertable) => (
        <InsertableCard key={insertable.id} insertable={insertable} />
    ));

    return (
        <>
            <SearchCallout objectLabel="element" filtered={result.filtered} />
            <ItemTable>{insertableCards}</ItemTable>
        </>
    );
}
