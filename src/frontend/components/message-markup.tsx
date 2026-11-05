import { Fragment, type ReactNode } from "react";
import { type MessagePart } from "../paraglide/runtime";

interface MessageMarkupProps {
    /** A message's `parts()`. */
    parts: MessagePart[];
    /** How each tag the message marks up wraps its text, by tag name. */
    markup: Record<string, (children: ReactNode) => ReactNode>;
}

/** A message with markup in its sentence, such as a link, kept as one message. */
export function MessageMarkup(props: MessageMarkupProps): ReactNode {
    const { parts, markup } = props;
    const stack: { name: string; children: ReactNode[] }[] = [
        { name: "", children: [] }
    ];
    let key = 0;
    const add = (node: ReactNode) =>
        stack[stack.length - 1].children.push(
            <Fragment key={key++}>{node}</Fragment>
        );
    for (const part of parts) {
        switch (part.type) {
            case "text":
                add(part.value);
                break;
            case "markup-start":
                stack.push({ name: part.name, children: [] });
                break;
            case "markup-end": {
                const closed = stack.pop()!;
                add(markup[closed.name](closed.children));
                break;
            }
            case "markup-standalone":
                add(markup[part.name](undefined));
                break;
        }
    }
    return stack[0].children;
}
