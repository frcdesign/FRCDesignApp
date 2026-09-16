import { useMemo } from "react";
import { ElementType } from "@backend/lib/onshape/element-type";
import { useTargetElement } from "../../lib/onshape-params";

/** The kind of tab the panel was launched on; absent when it was not. */
export function useTargetElementType(): ElementType | undefined {
    return useTargetElement()?.elementType;
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
