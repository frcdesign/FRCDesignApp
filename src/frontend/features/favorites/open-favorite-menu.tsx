import { openAppModal } from "../../components/open-app-modal";
import { type ParameterValues } from "@backend/features/configurations/models";
import { FavoriteMenuContent } from "./components/favorite-menu";
import { MenuTitle } from "../../components/app-title";
import { HeartIcon } from "./components/favorite-button";
import { IconSize } from "../../lib/style-constants";

interface OpenFavoriteMenuProps {
    favoriteId: string;
    insertableName: string;
    defaultConfiguration?: ParameterValues;
}

export function openFavoriteMenu(props: OpenFavoriteMenuProps) {
    const { favoriteId, insertableName, defaultConfiguration } = props;
    // Minted here so the content can update the header as the selection changes.
    const modalId = crypto.randomUUID();
    openAppModal({
        modalId,
        title: (
            <MenuTitle
                name={insertableName}
                icon={<HeartIcon size={IconSize.MEDIUM} />}
            />
        ),
        size: 500,
        children: (
            <FavoriteMenuContent
                favoriteId={favoriteId}
                modalId={modalId}
                defaultConfiguration={defaultConfiguration}
            />
        )
    });
}
