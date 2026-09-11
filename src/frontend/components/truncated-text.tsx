import { Text, type TextProps } from "@mantine/core";
import { type ReactNode, useRef, useState } from "react";

interface TruncatedTextProps extends TextProps {
    /** The whole text, offered as hover text only once the render clips it. */
    hoverText: string;
    /** What is drawn, e.g. the same text with its search matches underlined. */
    children: ReactNode;
}

/**
 * Names itself on hover when there is more of it than fits. Measured as the
 * pointer arrives, so a list pays nothing for a question only one row asks.
 */
export function TruncatedText(props: TruncatedTextProps): ReactNode {
    const { hoverText, children, ...others } = props;
    const ref = useRef<HTMLParagraphElement>(null);
    const [isClipped, setIsClipped] = useState(false);

    const measure = () => {
        const element = ref.current;
        setIsClipped(!!element && element.scrollWidth > element.clientWidth);
    };

    return (
        <Text
            ref={ref}
            truncate
            title={isClipped ? hoverText : undefined}
            onPointerEnter={measure}
            {...others}
        >
            {children}
        </Text>
    );
}
