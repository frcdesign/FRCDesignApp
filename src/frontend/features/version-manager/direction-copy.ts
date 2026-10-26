import { LinkDirection } from "@backend/features/version-manager/contract";

/** What each direction is called and does, kept in one place. */
export const DIRECTION_COPY = {
    [LinkDirection.PARENT]: {
        title: "Parents",
        quickAction: "Quick pull",
        description: "Documents you can pull changes from.",
        empty: "No linked parents"
    },
    [LinkDirection.CHILD]: {
        title: "Children",
        quickAction: "Quick push",
        description: "Documents you can push changes to.",
        empty: "No linked children"
    }
} as const;
