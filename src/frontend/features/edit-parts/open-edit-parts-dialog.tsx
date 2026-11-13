import { type ElementPath } from "@backend/lib/onshape/path";
import { openAppModal } from "../../components/open-app-modal";
import { m } from "../../paraglide/messages";
import { EditPartsDialog } from "./components/edit-parts-dialog";
import { setEditParts } from "./edit-picks";

/** Picks start empty each time, and go with the dialog. */
export function openEditPartsDialog(assembly: ElementPath): void {
    setEditParts([]);
    openAppModal({
        title: m.editPartsTitle(),
        size: 500,
        onClose: () => setEditParts([]),
        children: <EditPartsDialog assembly={assembly} />
    });
}
