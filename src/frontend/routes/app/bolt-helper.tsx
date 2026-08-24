import { createFileRoute } from "@tanstack/react-router";
import { BoltHelperPanel } from "../../features/bolt-helper/components/bolt-helper-panel";

export const Route = createFileRoute("/app/bolt-helper")({
    component: BoltHelperPanel
});
