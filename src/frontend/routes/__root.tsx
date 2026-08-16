import {
    createRootRoute,
    Outlet,
    useParams,
    useSearch
} from "@tanstack/react-router";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { MantineProvider } from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";
import { ReactNode, useMemo } from "react";
import { queryClient } from "../query-client";
import { getContextDataQuery } from "../queries";
import { createAppTheme } from "../theme";
import { getColorTheme } from "../api-utils/onshape-params";
import { DEFAULT_LIBRARY_ID, DEFAULT_SETTINGS } from "../../shared/types";
import { NotFoundError, RootCrash } from "../app/root-error";

export const Route = createRootRoute({
    component: RootComponent,
    // notFoundComponent renders inside the root Outlet, so it has the provider.
    notFoundComponent: NotFoundError,
    // errorComponent replaces the root component (no provider), so it must not use
    // Mantine. It only fires if the always-on root component itself throws.
    errorComponent: RootCrash
});

function RootComponent(): ReactNode {
    return (
        <QueryClientProvider client={queryClient}>
            <ThemedApp />
        </QueryClientProvider>
    );
}

/** Inside the provider, so it can read the user's theme as it arrives. */
function ThemedApp(): ReactNode {
    const search = useSearch({ strict: false });
    // Theme off the url so it recolors the instant a library switch navigates;
    // pages outside the app (errors, license) use the default library's color.
    const params = useParams({ strict: false });
    // Not awaited anywhere: the app paints with Onshape's color scheme and
    // resettles if the user has chosen their own.
    const { data } = useQuery(getContextDataQuery());

    const libraryId = params.libraryId ?? DEFAULT_LIBRARY_ID;
    const theme = useMemo(() => createAppTheme(libraryId), [libraryId]);
    const colorTheme = getColorTheme(
        data?.settings.theme ?? DEFAULT_SETTINGS.theme,
        search.systemTheme
    );

    return (
        <MantineProvider theme={theme} forceColorScheme={colorTheme}>
            <ModalsProvider labels={{ confirm: "Confirm", cancel: "Cancel" }}>
                <Notifications
                    position="bottom-center"
                    limit={3}
                    autoClose={4000}
                />
                <Outlet />
            </ModalsProvider>
        </MantineProvider>
    );
}
