import { createFileRoute } from "@tanstack/react-router";
import { TestbenchPage } from "../features/testbench/components/testbench-page";

/** A sibling of `/app`, like the dashboard: a full page without the panel's shell. */
export const Route = createFileRoute("/testbench")({
    component: TestbenchPage
});
