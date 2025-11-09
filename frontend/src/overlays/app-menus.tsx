import { AddDocumentMenu } from "../app/add-document-menu";
import { FavoriteMenu } from "../favorites/favorite-menu";
import { InsertMenu } from "../insert/insert-menu";
import { SettingsMenu } from "../navbar/settings-menu";

export function AppMenus() {
    return (
        <>
            <SettingsMenu />
            <InsertMenu />
            <AddDocumentMenu />
            <FavoriteMenu />
        </>
    );
}
