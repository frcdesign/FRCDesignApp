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
import { OnshapeParams } from "../../api-utils/onshape-params";
import { AppNavbar } from "../../app/app-navbar";
import { useMessageListener } from "../../api-utils/messages";
import { useLibraryJobWatcher } from "../../library-jobs/use-library-job-watcher";
import { RootAppError } from "../../app/root-error";
import { PrimaryColor } from "../../common/style-constants";
import { type ContextData } from "../../../shared/types";

export const Route = createFileRoute("/app")({
    component: App,
    validateSearch: (search: Record<string, unknown> & SearchSchemaInput) => {
        return search as unknown as OnshapeParams;
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
        return contextData;
    },
    loader: async ({ context }): Promise<ContextData> => {
        const accessData = context.accessData;
        const libraryId = context.settings.libraryId;
        await Promise.all([
            queryClient.prefetchQuery(
                getLibraryQuery(libraryId, accessData.cacheVersion)
            ),
            queryClient.prefetchQuery(
                getSearchDbQuery(libraryId, accessData.cacheVersion)
            ),
            queryClient.prefetchQuery(getFavoritesQuery(libraryId))
        ]);
        return context;
    },
    errorComponent: RootAppError
});

function App() {
    // The navbar (control row + always-open filters) is self-sizing, so measure
    // it and feed its height to AppShell rather than hardcoding one.
    const { ref: headerRef, height: headerHeight } = useElementSize();

    useMessageListener();
    useLibraryJobWatcher();

    return (
        <AppShell header={{ height: headerHeight || 56 }}>
            <AppShell.Header bg={PrimaryColor.FILLED} c={PrimaryColor.CONTRAST}>
                <div ref={headerRef}>
                    <AppNavbar />
                </div>
            </AppShell.Header>
            {/* Cap the main region at one viewport so it (not the window)
                scrolls; the fixed header covers the top of this scrollbar,
                keeping it within the body. */}
            <AppShell.Main h="100dvh" style={{ overflowY: "auto" }}>
                <Outlet />
                <TanStackRouterDevtools />
            </AppShell.Main>
        </AppShell>
    );
}
