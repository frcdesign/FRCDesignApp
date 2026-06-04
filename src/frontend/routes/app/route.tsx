import {
    createFileRoute,
    Outlet,
    retainSearchParams,
    type SearchSchemaInput
} from "@tanstack/react-router";
import { AppShell } from "@mantine/core";
import { useElementSize } from "@mantine/hooks";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { queryClient } from "../../query-client";
import {
    getFavoritesQuery,
    getContextDataQuery,
    getLibraryQuery,
    getSearchDbQuery
} from "../../queries";
import { type MenuParams } from "../../overlays/menu-params";
import { OnshapeParams } from "../../api-utils/onshape-params";
import { AppNavbar } from "../../navbar/app-navbar";
import { AppMenus } from "../../overlays/app-menus";
import { useMessageListener } from "../../api-utils/messages";
import { RootAppError } from "../../app/root-error";
import { type AccessData, type Settings } from "../../../shared/types";

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
    beforeLoad: async () => {
        // The auth-gated entry redirect lives in the `/init` route; here we just
        // expose the access level to child loaders/components.
        const contextData = await queryClient.ensureQueryData(
            getContextDataQuery()
        );
        return { accessData: contextData.accessData };
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
    // The navbar (control row + always-open filters) is self-sizing, so measure
    // it and feed its height to AppShell rather than hardcoding one.
    const { ref: headerRef, height: headerHeight } = useElementSize();

    useMessageListener();

    return (
        <AppShell header={{ height: headerHeight || 56 }} padding="sm">
            <AppShell.Header
                bg="var(--mantine-primary-color-filled)"
                c="var(--mantine-primary-color-contrast)"
            >
                <div ref={headerRef}>
                    <AppNavbar />
                </div>
            </AppShell.Header>
            {/* Cap the main region at one viewport so it (not the window)
                scrolls; the fixed header covers the top of this scrollbar,
                keeping it within the body. */}
            <AppShell.Main h="100dvh" style={{ overflowY: "auto" }}>
                <Outlet />
                <AppMenus />
                <TanStackRouterDevtools />
            </AppShell.Main>
        </AppShell>
    );
}
