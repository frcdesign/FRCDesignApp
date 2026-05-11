import { createServerFn } from "@tanstack/react-start";
import { FieldValue } from "firebase-admin/firestore";
import {
    Library,
    ElementType,
    ThumbnailUrls,
    Vendor
} from "../api-utils/client-models";
import { OAuthClient } from "../onshape-api/client/oauth-client";
import {
    AccessLevel,
    getAccessLevel,
    getUserId
} from "../onshape-api/endpoints/users";
import { getLibrary, LibraryRef } from "../connect/library";
import { getAuthSession } from "../routes/auth/-auth";

// --- Output types ---

export interface DocumentPathOut {
    documentId: string;
    instanceId: string;
    instanceType: "v";
}

export interface ElementPathOut extends DocumentPathOut {
    elementId: string;
}

export interface ElementOut {
    id: string;
    documentId: string;
    path: ElementPathOut;
    name: string;
    microversionId: string;
    isVisible: boolean;
    isOpenComposite: boolean;
    supportsFasten: boolean;
    elementType: ElementType;
    thumbnailUrls: ThumbnailUrls;
    configurationId?: string;
    vendors: Vendor[];
}

export interface DocumentOut {
    id: string;
    path: DocumentPathOut;
    name: string;
    sortAlphabetically: boolean;
    thumbnailUrls: ThumbnailUrls;
    elementOrder: string[];
}

export interface LibraryOut {
    documentOrder: string[];
    documents: Record<string, DocumentOut>;
    elements: Record<string, ElementOut>;
}

export interface FavoriteOut {
    id: string;
    defaultConfiguration: Record<string, string> | undefined;
}

export interface LibraryUserDataOut {
    favorites: Record<string, FavoriteOut>;
    favoriteOrder: string[];
}

// --- Server-side helpers ---

async function getClient(): Promise<OAuthClient> {
    const session = await getAuthSession();
    if (!session) throw new Error("Unauthorized");
    return new OAuthClient(session.accessToken);
}

async function getAppAccessLevel(client: OAuthClient): Promise<AccessLevel> {
    const override = process.env.ACCESS_LEVEL_OVERRIDE;
    if (override) return override as AccessLevel;

    const adminTeam = process.env.ADMIN_TEAM;
    if (!adminTeam)
        throw new Error(
            "ADMIN_TEAM or ACCESS_LEVEL_OVERRIDE must be configured"
        );

    return getAccessLevel(client, adminTeam);
}

async function requireAccess(
    client: OAuthClient,
    required: AccessLevel = AccessLevel.MEMBER
): Promise<void> {
    const level = await getAppAccessLevel(client);
    if (
        required === AccessLevel.MEMBER &&
        (level === AccessLevel.MEMBER || level === AccessLevel.ADMIN)
    )
        return;
    if (required === AccessLevel.ADMIN && level === AccessLevel.ADMIN) return;
    throw new Error("Insufficient permissions");
}

export async function buildLibraryOut(
    libraryRef: LibraryRef
): Promise<LibraryOut> {
    const library = await libraryRef.get();
    if (!library) throw new Error("Library not found");

    const documents: Record<string, DocumentOut> = {};
    const elements: Record<string, ElementOut> = {};

    await Promise.all(
        library.documentOrder.map(async (documentId) => {
            const docRef = libraryRef.documents.document(documentId);
            const document = await docRef.get();
            if (!document) return;

            documents[documentId] = {
                id: documentId,
                path: {
                    documentId,
                    instanceId: document.instanceId,
                    instanceType: "v"
                },
                name: document.name,
                sortAlphabetically: document.sortAlphabetically,
                thumbnailUrls: document.thumbnailUrls as ThumbnailUrls,
                elementOrder: document.elementOrder
            };

            await Promise.all(
                document.elementOrder.map(async (elementId) => {
                    const element = await docRef.elements
                        .element(elementId)
                        .get();
                    if (!element) return;

                    elements[elementId] = {
                        id: elementId,
                        documentId,
                        path: {
                            documentId,
                            instanceId: document.instanceId,
                            instanceType: "v",
                            elementId
                        },
                        name: element.name,
                        microversionId: element.microversionId,
                        isVisible: element.isVisible,
                        isOpenComposite: element.isOpenComposite,
                        supportsFasten: element.fastenInfo !== undefined,
                        elementType: element.elementType,
                        thumbnailUrls: element.thumbnailUrls as ThumbnailUrls,
                        configurationId: element.configurationId,
                        vendors: element.vendors
                    };
                })
            );
        })
    );

    return { documentOrder: library.documentOrder, documents, elements };
}

// --- Server functions ---

export const fetchLibraryData = createServerFn()
    .inputValidator((data: { library: Library }) => data)
    .handler(async ({ data: { library } }) => {
        return buildLibraryOut(getLibrary(library));
    });

export const fetchSearchDb = createServerFn()
    .inputValidator((data: { library: Library }) => data)
    .handler(async ({ data: { library } }) => {
        const lib = await getLibrary(library).get();
        return { searchDb: lib?.searchDb };
    });

export const fetchLibraryUserData = createServerFn()
    .inputValidator((data: { library: Library }) => data)
    .handler(async ({ data: { library } }): Promise<LibraryUserDataOut> => {
        const client = await getClient();
        const userId = await getUserId(client);

        const favoritesRef =
            getLibrary(library).userData.userDataFor(userId).favorites;
        const favoriteEntries = await favoritesRef.list();

        const favorites: Record<string, FavoriteOut> = {};
        for (const { id, data } of favoriteEntries) {
            favorites[id] = {
                id,
                defaultConfiguration: data.defaultConfiguration
            };
        }

        return {
            favorites,
            favoriteOrder: favoriteEntries.map(({ id }) => id)
        };
    });

export const addFavorite = createServerFn()
    .inputValidator(
        (data: {
            library: Library;
            elementId: string;
            defaultConfiguration?: Record<string, string>;
        }) => data
    )
    .handler(async ({ data: { library, elementId, defaultConfiguration } }) => {
        const client = await getClient();
        const userId = await getUserId(client);

        await getLibrary(library)
            .userData.userDataFor(userId)
            .favorites.add(elementId, {
                defaultConfiguration
            });

        return { success: true };
    });

export const removeFavorite = createServerFn()
    .inputValidator((data: { library: Library; elementId: string }) => data)
    .handler(async ({ data: { library, elementId } }) => {
        const client = await getClient();
        const userId = await getUserId(client);

        await getLibrary(library)
            .userData.userDataFor(userId)
            .favorites.remove(elementId);

        return { success: true };
    });

/** Sets the order of the current user's favorites. */
export const setFavoriteOrder = createServerFn()
    .inputValidator(
        (data: { library: Library; favoriteOrder: string[] }) => data
    )
    .handler(async ({ data: { library, favoriteOrder } }) => {
        const client = await getClient();
        const userId = await getUserId(client);

        await getLibrary(library)
            .userData.userDataFor(userId)
            .update({ favoriteOrder });

        return { success: true };
    });

export const updateDefaultConfiguration = createServerFn()
    .inputValidator(
        (data: {
            library: Library;
            favoriteId: string;
            defaultConfiguration: Record<string, string>;
        }) => data
    )
    .handler(
        async ({ data: { library, favoriteId, defaultConfiguration } }) => {
            const client = await getClient();
            const userId = await getUserId(client);

            await getLibrary(library)
                .userData.userDataFor(userId)
                .favorites.favorite(favoriteId)
                .update({ defaultConfiguration });

            return { success: true };
        }
    );

/**
 * Invalidates all CDN caching by incrementing the library's cache version.
 */
export const pushLibraryVersion = createServerFn({ method: "POST" })
    .inputValidator((data: { library: Library; searchDb: string }) => data)
    .handler(async ({ data: { library, searchDb } }) => {
        const client = await getClient();
        await requireAccess(client);

        const libraryRef = getLibrary(library);
        await libraryRef.ref.update({
            searchDb,
            cacheVersion: FieldValue.increment(1)
        });

        return { success: true };
    });
