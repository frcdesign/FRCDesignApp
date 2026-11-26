import { MenuTitle } from "../../components/app-title";
import { openAppModal } from "../../components/open-app-modal";
import {
    EditMenuContent,
    type EditMenuContentProps
} from "./components/edit-menu";

/** The configuration menu for the picked copies, over the panel. */
export function openEditMenu(props: EditMenuContentProps): void {
    openAppModal({
        title: <MenuTitle name={props.insertable.name} />,
        size: 500,
        children: <EditMenuContent {...props} />
    });
}
