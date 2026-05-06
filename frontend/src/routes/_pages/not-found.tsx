import { createFileRoute } from "@tanstack/react-router";
import { NotFoundError } from "../../app/root-error";

export const Route = createFileRoute("/_pages/not-found")({
    component: NotFoundError
});
