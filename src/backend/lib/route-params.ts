/** Route patterns and their param readers, so mounts and lookups stay in sync. */
import { internalError } from "./api-error";
import { HttpStatus } from "http-status-ts";
import z from "zod";
import { LibraryId } from "../features/library/library-id";
import { type AppContext } from "./context";

export function libraryRoute(): string {
    return "/library/:libraryId";
}

export function getLibraryParam(c: AppContext): LibraryId {
    const libraryId = c.req.param("libraryId");
    const parsed = z.enum(LibraryId).safeParse(libraryId);
    if (!parsed.success) {
        throw internalError("Invalid libraryId", HttpStatus.BAD_REQUEST);
    }
    return parsed.data;
}

export function insertableRoute(): string {
    return "/insertable/:insertableId";
}

export function getInsertableParam(c: AppContext): string {
    const id = c.req.param("insertableId");
    if (!id) throw new Error("Missing insertableId route param");
    return id;
}

export function favoriteRoute(): string {
    return "/favorite/:favoriteId";
}

export function getFavoriteParam(c: AppContext): string {
    const id = c.req.param("favoriteId");
    if (!id) throw new Error("Missing favoriteId route param");
    return id;
}

export function groupRoute(): string {
    return "/group/:groupId";
}

export function getGroupParam(c: AppContext): string {
    const id = c.req.param("groupId");
    if (!id) throw new Error("Missing groupId route param");
    return id;
}
