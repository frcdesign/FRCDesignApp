/** What a part's material can be set to: robot-code's `robotProperties.fs` materials. */
export interface Material {
    /** As Onshape's material library names it. */
    name: string;
    /** Kilograms per cubic metre. */
    density: number;
}

const POUNDS_PER_CUBIC_INCH = 27679.9047;

export const MATERIALS: readonly Material[] = [
    { name: "Aluminum - 6061", density: 0.098 * POUNDS_PER_CUBIC_INCH },
    { name: "Aluminum - 7075", density: 0.102 * POUNDS_PER_CUBIC_INCH },
    { name: "Steel", density: 0.284 * POUNDS_PER_CUBIC_INCH },
    { name: "Stainless Steel", density: 0.289 * POUNDS_PER_CUBIC_INCH },
    { name: "Onyx", density: 1180 },
    { name: "Acetal", density: 1410 }
];

export function findMaterial(name: string): Material | undefined {
    return MATERIALS.find((material) => material.name === name);
}
