import { useShowHidden } from "../../../../../features/auth/access-level";
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
import { IconSize, StatusColor } from "../../../../../lib/style-constants";
import { ReactNode } from "react";
import { SearchResults } from "../../../../../features/search/components/search-results";
import { InsertSource } from "@backend/features/analytics/usage";
import { GroupOut, Insertables } from "@backend/features/library/contract";
import { filterInsertables } from "../../../../../features/search/filter";
import { GroupMenuItems } from "../../../../../features/library/components/group-card";
import { InsertableCard } from "../../../../../features/library/components/insertable-card";
import { ItemTable } from "../../../../../components/item-row";
import { AppContextMenu, MenuButton } from "../../../../../components/app-menu";
import { SearchCallout } from "../../../../../features/search/components/search-errors";
import {
    SectionNotice,
    SectionLoading,
    SectionError,
    PageNotice
} from "../../../../../components/app-notice";
import {
    ClearFiltersButton,
    useVendorFilters
} from "../../../../../features/settings/components/vendor-filters";
import { useLibraryQuery } from "../../../../../features/library/queries";
import { useLibraryId } from "../../../../../lib/library";
import { updateUiState, useGetUiState } from "../../../../../lib/ui-state";
import { AppIcon } from "../../../../../components/app-icon";
import styles from "../../../../../lib/styles.module.css";

export const Route = createFileRoute("/app/library/$libraryId/groups/$groupId")(
    {
        component: GroupList,
        onEnter: (match) => {
            updateUiState({ groupId: match.params.groupId });
        }
    }
);

function GroupList(): ReactNode {
    const navigate = useNavigate();
    const libraryQuery = useLibraryQuery();
    const libraryId = useLibraryId();
    const { groupId } = useParams({
        from: "/app/library/$libraryId/groups/$groupId"
    });

    const uiState = useGetUiState();
    const vendorFilters = useVendorFilters();

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
            <PageNotice
                title="Group not found"
                justifyUp
                action={
                    <Button
                        variant="light"
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
                    vendors: vendorFilters,
                    groupId: group.id
                }}
                source={InsertSource.GROUP_SEARCH}
            />
        );
    } else {
        content = <GroupListContent group={group} insertables={insertables} />;
    }

    return (
        <>
            <GroupHeaderRow group={group} />
            {/* The group's own scroll container, so the header above it stays
                put and the page never scrolls on its behalf. It takes the room
                its list wants and no more, capped at what the main region has
                left — which is what `min-height` allows it to shrink to. */}
            <Box
                className={styles.dividerBottom}
                mih={0}
                style={{ overflowY: "auto" }}
            >
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
            // The same header the library's sections draw, divider and all.
            className={`interactive ${styles.sectionHeader} ${styles.dividerBottom}`}
            onClick={() =>
                void navigate({
                    to: "/app/library/$libraryId",
                    params: { libraryId }
                })
            }
            px="md"
            display="flex"
        >
            <Group justify="space-between" flex={1}>
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

function GroupListContent(props: GroupListCardsProps): ReactNode {
    const { group, insertables } = props;

    const showHidden = useShowHidden();
    const vendorFilters = useVendorFilters();

    const groupInsertables = group.insertableOrder
        .map((insertableId) => insertables[insertableId])
        .filter((insertable) => !!insertable);

    if (groupInsertables.length === 0) {
        return group.isLoaded ? (
            <SectionNotice title="This group has no visible elements" />
        ) : (
            <SectionNotice
                title="This group failed to load."
                description="Reload outdated documents to try again, or delete the group."
            />
        );
    }

    const result = filterInsertables(groupInsertables, {
        vendors: vendorFilters,
        visibleOnly: !showHidden
    });

    if (result.insertables.length === 0) {
        return (
            <SectionNotice
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
