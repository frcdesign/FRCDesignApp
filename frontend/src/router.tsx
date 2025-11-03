import { App } from "./app/app";
import { HomeList } from "./app/home-list";
import { GrantDenied } from "./pages/grant-denied";
import { License } from "./pages/license";
import {
    createRootRoute,
    createRoute,
    createRouter,
    redirect,
    retainSearchParams,
    SearchSchemaInput
} from "@tanstack/react-router";
import { queryClient } from "./query-client";
import { DocumentList } from "./app/document-list";
import { getUserDataQuery, getLibraryQuery } from "./queries";
import { UserData } from "./api/models";
import { SafariError } from "./pages/safari-error";
import { MenuParams } from "./search-params/menu-params";
import { OnshapeParams } from "./search-params/onshape-params";
import { getUiState, updateUiState } from "./api/ui-state";
import { RootAppError } from "./app/root-error";
import { AlertParams } from "./search-params/alert-type";
import { getSearchDbQuery } from "./search/search";
import { UserPath } from "./api/path";

type SearchParams = OnshapeParams & MenuParams & AlertParams & UserData;

const rootRoute = createRootRoute({
    errorComponent: () => <RootAppError isRoot />
});

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
        search.systemTheme = search.theme;
        delete search.theme;
        return search as unknown as SearchParams;
    },
    search: {
        middlewares: [retainSearchParams(true)]
    },
    beforeLoad: async ({ location }) => {
        if (location.pathname !== "/app") {
            return;
        }

        const search = location.search as OnshapeParams;
        const userPath: UserPath = { userId: search.userId };
        const userData = await queryClient.ensureQueryData(
            getUserDataQuery(userPath)
        );

        const uiState = getUiState();
        if (uiState.openDocumentId) {
            return redirect({
                to: "/app/documents/$documentId",
                params: { documentId: uiState.openDocumentId },
                // Add userData to search
                search: () => userData
            });
        }

        return redirect({
            to: "/app/documents",
            // Add userData to search
            search: () => userData
        });
    },
    loaderDeps: ({ search }) => ({
        library: search.library,
        cacheOptions: {
            currentAccessLevel: search.currentAccessLevel,
            cacheVersion: search.cacheVersion
        }
    }),
    loader: async ({ deps }) => {
        Promise.all([
            queryClient.prefetchQuery(
                getLibraryQuery(deps.library, deps.cacheOptions)
            ),
            queryClient.prefetchQuery(
                getSearchDbQuery(deps.library, deps.cacheOptions)
            )
        ]);
    },
    // Include it higher up in the hopes that accessLevel will be loaded for the escape hatch
    errorComponent: RootAppError
});

const homeRoute = createRoute({
    getParentRoute: () => appRoute,
    path: "documents"
});

const homeListRoute = createRoute({
    getParentRoute: () => homeRoute,
    path: "/",
    component: HomeList,
    onEnter: () => {
        updateUiState({ openDocumentId: undefined });
    }
});

const documentListRoute = createRoute({
    getParentRoute: () => homeRoute,
    path: "$documentId",
    component: DocumentList,
    onEnter: (match) => {
        updateUiState({
            openDocumentId: match.params.documentId
        });
    }
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
});
