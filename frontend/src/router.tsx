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
import {
    getContextDataQuery,
    getDocumentOrderQuery,
    getDocumentsQuery,
    getElementsQuery,
    getUserDataQuery
} from "./queries";
import { ContextData } from "./api/models";
import { SafariError } from "./pages/safari-error";
import { MenuParams } from "./api/menu-params";
import { OnshapeParams } from "./api/onshape-params";
import { getUiState, updateUiState } from "./api/ui-state";
import { RootAppError } from "./app/root-error";
import { getSearchDbQuery } from "./search/search";

type SearchParams = OnshapeParams & MenuParams & ContextData;

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
    beforeLoad: async ({ location, search }) => {
        if (location.pathname !== "/app") {
            return;
        }

        const contextData = await queryClient.ensureQueryData(
            getContextDataQuery(search)
        );
        const uiState = getUiState();

        if (uiState.openDocumentId) {
            return redirect({
                to: "/app/documents/$documentId",
                params: { documentId: uiState.openDocumentId },
                search: () => contextData
            });
        }

        return redirect({
            to: "/app/documents",
            search: () => contextData
        });
    },
    loaderDeps: ({ search }) => ({
        userId: search.userId,
        currentAccessLevel: search.currentAccessLevel,
        cacheVersion: search.cacheVersion
    }),
    loader: async ({ deps }) => {
        Promise.all([
            queryClient.prefetchQuery(getDocumentOrderQuery(deps)),
            queryClient.prefetchQuery(getDocumentsQuery(deps)),
            queryClient.prefetchQuery(getElementsQuery(deps)),
            queryClient.prefetchQuery(getSearchDbQuery(deps))
        ]);
        // We need settings immediately to determine the theme
        return queryClient.ensureQueryData(getUserDataQuery(deps));
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
        // appRedirectRoute,
        homeRoute.addChildren([homeListRoute, documentListRoute])
    ]),
    grantDeniedRoute,
    licenseRoute,
    safariErrorRoute
]);

export const router = createRouter({
    routeTree,
    defaultStaleTime: Infinity,
    defaultGcTime: Infinity
});
