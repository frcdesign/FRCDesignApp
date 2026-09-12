/**
 * The `/api` path segments a resource is addressed by, matching the routes the
 * worker mounts in `lib/route-params.ts`.
 */
import { LibraryId } from "@backend/features/library/library-id";

export function toLibraryPath(libraryId: LibraryId): string {
    return `/library/${libraryId}`;
}

export function toInsertablePath(insertableId: string): string {
    return `/insertable/${insertableId}`;
}

export function toFavoritePath(favoriteId: string): string {
    return `/favorite/${favoriteId}`;
}
