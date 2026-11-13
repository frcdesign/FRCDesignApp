import { MenuTitle } from "../../components/app-title";
import { openAppModal } from "../../components/open-app-modal";
import { EditMenuContent, type EditMenuProps } from "./components/edit-menu";

export function openEditMenu(props: EditMenuProps): void {
    openAppModal({
        title: <MenuTitle name={props.insertable.name} />,
        size: 500,
        children: <EditMenuContent {...props} />
    });
}
