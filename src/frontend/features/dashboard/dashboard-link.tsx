import { Anchor, type AnchorProps } from "@mantine/core";
import { createLink, type LinkComponent } from "@tanstack/react-router";
import { type ReactNode, type Ref } from "react";

interface MantineAnchorProps extends Omit<AnchorProps, "href"> {
    ref?: Ref<HTMLAnchorElement>;
    children?: ReactNode;
}

/**
 * A Mantine-styled router link.
 *
 * `<Anchor component={Link}>` type-checks its props against Mantine's polymorphic
 * signature, which drops the router's `to`/`params` generics; `createLink` keeps
 * them.
 */
function MantineAnchor(props: MantineAnchorProps): ReactNode {
    return <Anchor {...props} />;
}

const CreatedLink = createLink(MantineAnchor);

/**
 * Carries the current search across by default, so the selected range survives
 * a drill-down into a library. Pass `search` explicitly to override.
 */
export const DashboardLink: LinkComponent<typeof MantineAnchor> = (props) => (
    <CreatedLink preload="intent" search={(prev) => prev} {...props} />
);
