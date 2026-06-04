import {
    createFileRoute,
    Outlet,
    redirect,
    retainSearchParams,
    type SearchSchemaInput,
    useLoaderData,
    useSearch
} from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { AppShell, MantineProvider } from "@mantine/core";
import { useElementSize } from "@mantine/hooks";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { useMemo } from "react";
import { queryClient } from "../../query-client";
import {
    getFavoritesQuery,
    getContextDataQuery,
    getLibraryQuery,
    getSearchDbQuery
} from "../../queries";
import { type MenuParams } from "../../overlays/menu-params";
import {
    getColorScheme,
    getColorTheme,
    OnshapeParams
} from "../../api-utils/onshape-params";
import { createAppTheme } from "../../theme";
import { getUiState } from "../../api-utils/ui-state";
import { AppNavbar } from "../../navbar/app-navbar";
import { AppMenus } from "../../overlays/app-menus";
import { useMessageListener } from "../../api-utils/messages";
import { RootAppError } from "../../app/root-error";
import { type AccessData, Library, type Settings } from "../../../shared/types";

type SearchParams = OnshapeParams & MenuParams & { settings: Settings };

export const Route = createFileRoute("/app")({
    component: App,
    validateSearch: (search: Record<string, unknown> & SearchSchemaInput) => {
        // Onshape only sends `theme` on the initial load. Only remap it when it's
        // actually present so internal navigations (e.g. switching libraries)
        // don't wipe the retained `systemTheme` and reset light/dark mode.
        if (search.theme !== undefined) {
            search.systemTheme = search.theme;
            delete search.theme;
        }
        return search as unknown as SearchParams;
    },
    search: {
        middlewares: [retainSearchParams(true)]
    },
    beforeLoad: async ({ location }) => {
        const contextData = await queryClient.ensureQueryData(
            getContextDataQuery()
        );
        const context = { accessData: contextData.accessData };
        if (location.pathname !== "/app") {
            return context;
        }

        const settings = { settings: contextData.settings };

        const uiState = getUiState();
        if (uiState.openDocumentId) {
            throw redirect({
                to: "/app/documents/$documentId",
                params: { documentId: uiState.openDocumentId },
                search: settings
            });
        }
        // must throw redirects here for type inference to work
        throw redirect({
            to: "/app/documents",
            search: settings
        });
    },
    loaderDeps: ({ search }) => ({
        library: search.settings?.library
    }),
    loader: async ({ context, deps }): Promise<AccessData> => {
        const accessData = context.accessData;
        await Promise.all([
            queryClient.prefetchQuery(
                getLibraryQuery(deps.library, accessData)
            ),
            queryClient.prefetchQuery(
                getSearchDbQuery(deps.library, accessData)
            ),
            queryClient.prefetchQuery(getFavoritesQuery(deps.library))
        ]);
        return accessData;
    },
    errorComponent: RootAppError
});

function App() {
    const search = useSearch({ from: "/app" });
    const loaderData = useLoaderData({ from: "/app" });
    const colorTheme = getColorTheme(
        search.settings?.theme,
        search.systemTheme
    );
    void loaderData; // consumed by child components via useLoaderData

    const library = search.settings?.library ?? Library.FRC_DESIGN_LIB;
    const theme = useMemo(() => createAppTheme(library), [library]);

    // The navbar (control row + always-open filters) is self-sizing, so measure
    // it and feed its height to AppShell rather than hardcoding one.
    const { ref: headerRef, height: headerHeight } = useElementSize();

    useMessageListener();

    return (
        <QueryClientProvider client={queryClient}>
            <MantineProvider
                theme={theme}
                forceColorScheme={getColorScheme(colorTheme)}
            >
                <ModalsProvider
                    labels={{ confirm: "Confirm", cancel: "Cancel" }}
                >
                    <Notifications position="bottom-center" limit={3} />
                    <AppShell header={{ height: headerHeight }} padding="md">
                        <AppShell.Header
                            bg="var(--mantine-primary-color-filled)"
                            c="var(--mantine-primary-color-contrast)"
                        >
                            <div ref={headerRef}>
                                <AppNavbar />
                            </div>
                        </AppShell.Header>
                        {/* Cap the main region at one viewport so it (not the
                            window) scrolls; the fixed header covers the top of
                            this scrollbar, keeping it within the body. */}
                        <AppShell.Main h="100dvh" style={{ overflowY: "auto" }}>
                            <Outlet />
                            <AppMenus />
                            <TanStackRouterDevtools />
                        </AppShell.Main>
                    </AppShell>
                </ModalsProvider>
            </MantineProvider>
        </QueryClientProvider>
    );
}
