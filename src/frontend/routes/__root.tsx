import { createRootRoute, Outlet } from "@tanstack/react-router";
import { NotFoundError, RootAppError } from "../app/root-error";

export const Route = createRootRoute({
    component: () => <Outlet />,
    errorComponent: () => <RootAppError isRoot />,
    notFoundComponent: () => <NotFoundError />
});
