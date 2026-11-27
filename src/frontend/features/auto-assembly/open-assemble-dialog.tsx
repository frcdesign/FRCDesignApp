/** Kept out of the component files, so those export only components for React Refresh. */
import { type ElementPath } from "@backend/lib/onshape/path";
import { AppTitle } from "../../components/app-title";
import { openAppModal } from "../../components/open-app-modal";
import { m } from "../../paraglide/messages";
import { AssembleDialog } from "./components/assemble-dialog";

/** The parts the assembly's FeatureScripts declared, to choose from and assemble. */
export function openAssembleDialog(assembly: ElementPath): void {
    openAppModal({
        title: <AppTitle title={m.autoAssemblyAssembleTitle()} />,
        children: <AssembleDialog assembly={assembly} />
    });
}
