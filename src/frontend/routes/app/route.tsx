import {
    createFileRoute,
    Outlet,
    redirect,
    retainSearchParams,
    type SearchSchemaInput
} from "@tanstack/react-router";
import { AppShell } from "@mantine/core";
import { useElementSize } from "@mantine/hooks";
import { Suspense } from "react";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { OnshapeParams } from "../../lib/onshape-params";
import { AppNavbar } from "../../components/app-navbar";
import { SectionLoading } from "../../components/app-zero-state";
import { useMessageListener } from "../../lib/messages";
import { updateUiState } from "../../lib/ui-state";
import { RootAppError } from "../../components/root-error";

export const Route = createFileRoute("/app")({
    component: App,
    validateSearch: (search: Record<string, unknown> & SearchSchemaInput) => {
        return search as unknown as OnshapeParams;
    },
    search: {
        // What Onshape launched us with, which every navigation keeps. The
        // theme rides along too, but only as far as beforeLoad below.
        middlewares: [
            retainSearchParams([
                "documentId",
                "instanceId",
                "instanceType",
                "elementId",
                "elementType",
                "systemTheme",
                "server"
            ])
        ]
    },
    beforeLoad: ({ search, location }) => {
        // The entry redirect seeds the account's saved theme; ui-state is what
        // the app reads, so take it rather than leave a second answer in the url.
        if (search.theme) {
            updateUiState({ theme: search.theme });
            throw redirect({
                to: location.pathname,
                search: { ...search, theme: undefined },
                replace: true
            });
        }
    },
    errorComponent: RootAppError
});

function App() {
    // The navbar (control row + always-open filters) is self-sizing, so measure
    // it and feed its height to AppShell rather than hardcoding one.
    const { ref: headerRef, height: headerHeight } = useElementSize();

    useMessageListener();

    return (
        <AppShell header={{ height: headerHeight || 56 }}>
            <AppShell.Header>
                <div ref={headerRef}>
                    <AppNavbar />
                </div>
            </AppShell.Header>
            {/* Cap the main region at one viewport so it (not the window)
                scrolls; the fixed header covers the top of this scrollbar,
                keeping it within the body. */}
            <AppShell.Main h="100dvh" style={{ overflowY: "auto" }}>
                {/* Without a boundary here, a pending match suspends past
                    the navbar to the root and blanks the page. */}
                <Suspense
                    fallback={<SectionLoading title="Loading library..." />}
                >
                    <Outlet />
                </Suspense>
                <TanStackRouterDevtools />
            </AppShell.Main>
        </AppShell>
    );
}
