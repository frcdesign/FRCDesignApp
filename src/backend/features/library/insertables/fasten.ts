/** Where an insertable's fasten mate connector lives inside its element. */
export enum MateLocation {
    Feature = "Feature",
    Part = "Part",
    Subassembly = "Subassembly"
}

export interface FastenInfo {
    mateConnectorId: string;
    mateLocation: MateLocation;
    path: string[];
}
