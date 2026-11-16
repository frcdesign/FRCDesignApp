import { useMemo } from "react";
import { ElementType } from "@backend/lib/onshape/element-type";
import { type InsertableOut } from "@backend/features/library/contract";
import { useTargetElement } from "../../lib/onshape-params";

/** The kind of tab the panel was launched on; absent when it was not. */
export function useTargetElementType(): ElementType | undefined {
    return useTargetElement()?.elementType;
}

/** Whether inserting this part into the open tab can also fasten it. */
export function useCanFasten(insertable: InsertableOut): boolean {
    const targetElementType = useTargetElementType();
    return (
        insertable.supportsFasten && targetElementType === ElementType.ASSEMBLY
    );
}

export function useIsAssemblyInPartStudio(elementType: ElementType): boolean {
    const targetElementType = useTargetElementType();
    return useMemo(() => {
        return (
            elementType === ElementType.ASSEMBLY &&
            targetElementType === ElementType.PART_STUDIO
        );
    }, [elementType, targetElementType]);
}
