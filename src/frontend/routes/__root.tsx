import {
    createRootRoute,
    Outlet,
    useParams,
    useSearch
} from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { MantineProvider } from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";
import { ReactNode, useMemo } from "react";
import { queryClient } from "../lib/query-client";
import { createAppTheme } from "../theme";
import { getColorTheme } from "../lib/onshape-params";
import { DEFAULT_SETTINGS } from "@backend/features/settings/settings";
import { NotFoundError, RootCrash } from "../components/root-error";

export const Route = createRootRoute({
    component: RootComponent,
    // notFoundComponent renders inside the root Outlet, so it has the provider.
    notFoundComponent: NotFoundError,
    // errorComponent replaces the root component (no provider), so it must not use
    // Mantine. It only fires if the always-on root component itself throws.
    errorComponent: RootCrash
});

function RootComponent(): ReactNode {
    const search = useSearch({ strict: false });
    // Both come off the url — the entry redirect seeds them and a switch
    // rewrites them — so the first paint is already the right colors.
    const params = useParams({ strict: false });

    const libraryId = params.libraryId ?? DEFAULT_SETTINGS.libraryId;
    const theme = useMemo(() => createAppTheme(libraryId), [libraryId]);
    const colorTheme = getColorTheme(
        search.theme ?? DEFAULT_SETTINGS.theme,
        search.systemTheme
    );

    return (
        <QueryClientProvider client={queryClient}>
            <MantineProvider theme={theme} forceColorScheme={colorTheme}>
                <ModalsProvider
                    labels={{ confirm: "Confirm", cancel: "Cancel" }}
                >
                    <Notifications
                        position="bottom-center"
                        limit={3}
                        autoClose={4000}
                        // Mantine pins this at 440px otherwise, wrapping a
                        // message with an action button even on a wide window.
                        // Mantine clamps it to the viewport on a narrow one.
                        containerWidth="max-content"
                    />
                    <Outlet />
                </ModalsProvider>
            </MantineProvider>
        </QueryClientProvider>
    );
}
