import { Menu } from "@mantine/core";
import { ArrowsClockwiseIcon } from "@phosphor-icons/react";
import { ReactNode } from "react";
import { m } from "../../../paraglide/messages";
import { useUpdateReferencesMutation } from "../queries";

interface UpdateReferencesMenuItemProps {
    documentId: string;
    /** One tab's references; omitted, the whole document's. */
    elementId?: string;
}

/** Moves out-of-date references in the document's default workspace, which the next version carries into the library. */
export function UpdateReferencesMenuItem(
    props: UpdateReferencesMenuItemProps
): ReactNode {
    const mutation = useUpdateReferencesMutation(
        props.documentId,
        props.elementId
    );
    return (
        <Menu.Item
            leftSection={<ArrowsClockwiseIcon />}
            onClick={() => mutation.mutate()}
        >
            {m.libraryUpdateReferences()}
        </Menu.Item>
    );
}
