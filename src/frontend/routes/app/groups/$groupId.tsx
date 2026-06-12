import {
    createFileRoute,
    Outlet,
    useLoaderData,
    useNavigate,
    useParams
} from "@tanstack/react-router";
import { Box, Button, Group, Menu, Text } from "@mantine/core";
import {
    IconAlertTriangle,
    IconArrowBackUp,
    IconArrowLeft
} from "@tabler/icons-react";
import { BORDER, FontWeight, IconSize } from "../../../common/style-constants";
import { ReactNode } from "react";
import { SearchResults } from "../../../search/search-results";
import { GroupOut, Insertables } from "../../../../shared/api-models";
import { hasEditorAccess } from "../../../../shared/types";
import { filterInsertables } from "../../../search/filter";
import { GroupMenuItems } from "../../../cards/group-card";
import { InsertableCard } from "../../../cards/insertable-card";
import { MenuButton, ItemTable } from "../../../cards/card-components";
import { SearchCallout } from "../../../search/search-errors";
import {
    PageError,
    SectionError,
    SectionLoading
} from "../../../common/app-zero-state";
import { ClearFiltersButton } from "../../../navbar/vendor-filters";
import { useLibraryQuery } from "../../../queries";
import { useUiState, updateUiState } from "../../../api-utils/ui-state";

export const Route = createFileRoute("/app/groups/$groupId")({
    component: GroupList,
    onEnter: (match) => {
        updateUiState({ openGroupId: match.params.groupId });
    }
});

function GroupList(): ReactNode {
    const navigate = useNavigate();
    const libraryQuery = useLibraryQuery();
    const groupId = useParams({
        from: "/app/groups/$groupId"
    }).groupId;

    const uiState = useUiState()[0];

    if (libraryQuery.isPending) {
        return <SectionLoading title="Loading groups..." />;
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
                        leftSection={<IconArrowBackUp size={IconSize.SMALL} />}
                        onClick={() => {
                            void navigate({ to: "/app/groups" });
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
            <Box
                style={{
                    borderBottom: BORDER,
                    borderTop: BORDER
                }}
            >
                {content}
                <Outlet />
            </Box>
        </>
    );
}

function GroupHeaderRow({ group }: { group: GroupOut }): ReactNode {
    const navigate = useNavigate();
    const menuItems = <GroupMenuItems group={group} />;

    const header = (
        <Box
            className="interactive mantine-auto-focus"
            onClick={() => void navigate({ to: "/app/groups" })}
            p="sm"
        >
            <Group wrap="nowrap" justify="space-between">
                <Group gap="sm">
                    <IconArrowLeft size={IconSize.MEDIUM} />
                    <Text size="md" fw={FontWeight.SEMI_BOLD} truncate>
                        {group.name}
                    </Text>
                </Group>
                <MenuButton>{menuItems}</MenuButton>
            </Group>
        </Box>
    );

    return (
        <Menu shadow="md" width={220} withinPortal>
            <Menu.ContextMenu>{header}</Menu.ContextMenu>
            <Menu.Dropdown>{menuItems}</Menu.Dropdown>
        </Menu>
    );
}

interface GroupListCardsProps {
    group: GroupOut;
    insertables: Insertables;
}

export function GroupListContent(props: GroupListCardsProps): ReactNode {
    const { group, insertables } = props;

    const loaderData = useLoaderData({ from: "/app" });
    const uiState = useUiState()[0];

    const groupInsertables = group.insertableOrder
        .map((insertableId) => insertables[insertableId])
        .filter((insertable) => !!insertable);

    if (groupInsertables.length === 0) {
        return (
            <SectionError
                title="This group has no visible elements"
                description={null}
            />
        );
    }

    const filterResult = filterInsertables(groupInsertables, {
        vendors: uiState.vendorFilters,
        isVisible: !hasEditorAccess(loaderData.accessData.currentAccessLevel)
    });

    if (filterResult.insertables.length === 0) {
        return (
            <SectionError
                icon={
                    <IconAlertTriangle
                        size={IconSize.LARGE}
                        color="var(--mantine-color-yellow-6)"
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
