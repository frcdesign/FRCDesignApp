import { InstancePath, InstanceType } from "./path";

export function assertInstanceType(
    path: InstancePath,
    ...instanceTypes: InstanceType[]
): void {
    if (!instanceTypes.includes(path.instanceType)) {
        const expected = instanceTypes.join(" or ");
        throw new Error(
            `Path must be ${expected}, got "${path.instanceType}"`
        );
    }
}

export function assertWorkspace(path: InstancePath): void {
    assertInstanceType(path, "w");
}

export function assertVersion(path: InstancePath): void {
    assertInstanceType(path, "v");
}
