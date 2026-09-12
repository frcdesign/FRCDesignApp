import { useSearch } from "@tanstack/react-router";
import { useMemo } from "react";
import { ElementType } from "@backend/lib/onshape/element-type";
export function useTargetElementType(): ElementType {
    const search = useSearch({ from: "/app" });
    return search.elementType;
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
