import { App } from "./app/app";
import { HomeList } from "./app/home-list";
import { GrantDenied } from "./pages/grant-denied";
import { License } from "./pages/license";
import {
    createRootRoute,
    createRoute,
    createRouter,
    retainSearchParams,
    SearchSchemaInput
} from "@tanstack/react-router";
import { queryClient } from "./query-client";
import { DocumentList } from "./document/document-list";
import {
    getDocumentsQuery,
    getElementsQuery,
    getFavoritesQuery
} from "./queries";
import { SafariError } from "./pages/safari-error";
import { MenuParams } from "./api/menu-params";
import { OnshapeParams } from "./api/onshape-params";
import { AccessLevel, Vendor } from "./api/backend-types";

export interface BaseSearchParams {
    /**
     * The maximum access level the user can have.
     */
    maxAccessLevel: AccessLevel;
    /**
     * The access level the user is currently using.
     */
    accessLevel: AccessLevel;
    query?: string;
    vendors?: Vendor[];
}

type SearchParams = OnshapeParams & BaseSearchParams & MenuParams;

const rootRoute = createRootRoute();

/**
 * When the app is first loaded by Onshape, Onshape provides search params indiciating the context the app is being accessed from.
 * This route saves those parameters off to a store for later.
 */
const appRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "app",
    component: App,
    // Add SearchSchemaInput so search parameters become optional
    validateSearch: (search: Record<string, unknown> & SearchSchemaInput) => {
        return search as unknown as SearchParams;
    },
    search: {
        middlewares: [retainSearchParams(true)]
    }
});

const homeRoute = createRoute({
    getParentRoute: () => appRoute,
    path: "documents",
    loaderDeps: ({ search }) => ({ userId: search.userId }),
    loader: async ({ deps }) => {
        const loadDocuments = getDocumentsQuery();
        const loadElements = getElementsQuery();
        const loadFavorites = getFavoritesQuery(deps);

        return Promise.all([
            queryClient.ensureQueryData(loadDocuments),
            queryClient.ensureQueryData(loadElements),
            queryClient.ensureQueryData(loadFavorites)
        ]);
    }
});

const homeListRoute = createRoute({
    getParentRoute: () => homeRoute,
    path: "/",
    component: HomeList
});

const documentListRoute = createRoute({
    getParentRoute: () => homeRoute,
    path: "$documentId",
    component: DocumentList
});

const grantDeniedRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "grant-denied",
    component: GrantDenied
});

const licenseRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "license",
    component: License
});

const safariErrorRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "safari-error",
    component: SafariError
});

const routeTree = rootRoute.addChildren([
    appRoute.addChildren([
        homeRoute.addChildren([homeListRoute, documentListRoute])
    ]),
    grantDeniedRoute,
    licenseRoute,
    safariErrorRoute
]);

export const router = createRouter({
    routeTree
    // Database is immutable, so no need to refetch things
    // defaultStaleTime: Infinity
});
