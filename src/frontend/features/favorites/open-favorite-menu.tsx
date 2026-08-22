import { openAppModal } from "../../components/open-app-modal";
import { type ParameterValues } from "@backend/features/configurations/models";
import {
    FavoriteMenuContent,
    FavoriteMenuTitle
} from "./components/favorite-menu";

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
        title: <FavoriteMenuTitle name={insertableName} />,
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
