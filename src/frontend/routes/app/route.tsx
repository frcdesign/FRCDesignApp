import {
    createFileRoute,
    Outlet,
    retainSearchParams,
    type SearchSchemaInput
} from "@tanstack/react-router";
import { AppShell } from "@mantine/core";
import { useElementSize } from "@mantine/hooks";
import { Suspense } from "react";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { OnshapeParams } from "../../api-utils/onshape-params";
import { AppNavbar } from "../../app/app-navbar";
import { SectionLoading } from "../../app-common/app-zero-state";
import { useMessageListener } from "../../api-utils/messages";
import { useSignInToast } from "../../api-utils/sign-in";
import { RootAppError } from "../../app/root-error";
import { PrimaryColor } from "../../common/style-constants";

export const Route = createFileRoute("/app")({
    component: App,
    validateSearch: (search: Record<string, unknown> & SearchSchemaInput) => {
        return search as unknown as OnshapeParams;
    },
    search: {
        middlewares: [retainSearchParams(true)]
    },
    errorComponent: RootAppError
});

function App() {
    // The navbar (control row + always-open filters) is self-sizing, so measure
    // it and feed its height to AppShell rather than hardcoding one.
    const { ref: headerRef, height: headerHeight } = useElementSize();

    useMessageListener();
    useSignInToast();

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
