import { ArrowRightIcon } from "@phosphor-icons/react";
import { IconSize } from "../../../lib/style-constants";
import { useNavigate } from "@tanstack/react-router";
import { PropsWithChildren, ReactNode } from "react";
import { GroupOut } from "@backend/features/library/contract";
import { MenuSection } from "../../../components/app-menu";
import { CardTitle, ItemRow } from "../../../components/item-row";
import { OpenDocumentItems } from "../../../components/open-document-items";
import { GroupChangesBadge } from "./changes-badges";
import { CardThumbnail } from "../../thumbnails/components/thumbnail";
import { GroupStatusBadge } from "../../build-status/components/build-status";
import { useLibraryId } from "../../../lib/library";
import { m } from "../../../paraglide/messages";

interface GroupCardProps extends PropsWithChildren {
    group: GroupOut;
}

export function GroupCard(props: GroupCardProps): ReactNode {
    const { group } = props;
    const navigate = useNavigate();
    const libraryId = useLibraryId();
    return (
        <ItemRow
            onClick={() => {
                void navigate({
                    to: "/app/library/$libraryId/groups/$groupId",
                    params: { libraryId, groupId: group.id }
                });
            }}
            left={
                <CardTitle
                    title={group.name}
                    disabled={!group.isLoaded}
                    thumbnail={
                        <CardThumbnail
                            smallThumbnailUrl={group.smallThumbnailUrl}
                            largeThumbnailUrl={group.largeThumbnailUrl}
                        />
                    }
                    badge={
                        <>
                            <GroupChangesBadge documentId={group.documentId} />
                            <GroupStatusBadge
                                groupId={group.id}
                                name={group.name}
                            />
                        </>
                    }
                />
            }
            rightSection={<ArrowRightIcon size={IconSize.SMALL} />}
            moreButton={false}
            menuItems={<GroupMenuItems group={group} />}
        />
    );
}

interface GroupMenuItemsProps {
    group: GroupOut;
}

export function GroupMenuItems(props: GroupMenuItemsProps): ReactNode {
    const { group } = props;
    return (
        <MenuSection label={m.libraryMenuDocument()}>
            <OpenDocumentItems path={group.path} />
        </MenuSection>
    );
}
