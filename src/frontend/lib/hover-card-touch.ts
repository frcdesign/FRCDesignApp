/**
 * What a hover card needs on a touchscreen beyond Mantine's `events.touch`:
 * to stay open after the tap that opened it, and to keep the tap that
 * dismisses it from landing on the row underneath.
 */

/** Whether a touch or pen is down, read while its pointerdown dismisses a card. */
let isTouchPressing = false;
let isWatching = false;

const onPointerDown = (event: PointerEvent) => {
    isTouchPressing = event.pointerType !== "mouse";
};
const onPointerEnd = () => {
    isTouchPressing = false;
};

/**
 * Starts following presses, on the window's capture phase so it sees one
 * before floating-ui's dismissal does, which listens on the document.
 */
export function watchPresses(): void {
    if (isWatching) {
        return;
    }
    isWatching = true;
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("pointerup", onPointerEnd, true);
    window.addEventListener("pointercancel", onPointerEnd, true);
}

const swallow = (event: Event) => {
    event.stopPropagation();
    event.preventDefault();
};

/**
 * Stops the click that ends the press dismissing a card, so a tap outside it
 * closes the card and does nothing else. A mouse click and Escape pass.
 */
export function swallowDismissingClick(): void {
    if (!isTouchPressing) {
        return;
    }
    window.addEventListener("click", swallow, { capture: true, once: true });
    // A press that ends without a click, such as a scroll, must not take a
    // later one; the click comes before this timeout runs.
    const disarm = () =>
        window.setTimeout(() =>
            window.removeEventListener("click", swallow, true)
        );
    window.addEventListener("pointerup", disarm, { capture: true, once: true });
    window.addEventListener("pointercancel", disarm, {
        capture: true,
        once: true
    });
}

/**
 * A ref for the card's target. Chrome follows a tap's click with a
 * `mouseleave`, which floating-ui takes as the finger leaving and closes the
 * card on; this drops that one event, so a tapped card stays until dismissed.
 * Capture runs before floating-ui's own listener on the same element.
 */
export function holdOpenAfterTap(target: HTMLElement | null): () => void {
    if (!target) {
        return () => undefined;
    }
    let wasTapped = false;
    const onPointerDown = (event: PointerEvent) => {
        wasTapped = event.pointerType !== "mouse";
    };
    // Capture also sees each child's own leave on its way down.
    const onMouseLeave = (event: MouseEvent) => {
        if (wasTapped && event.target === target) {
            wasTapped = false;
            event.stopImmediatePropagation();
        }
    };
    target.addEventListener("pointerdown", onPointerDown);
    target.addEventListener("mouseleave", onMouseLeave, true);
    return () => {
        target.removeEventListener("pointerdown", onPointerDown);
        target.removeEventListener("mouseleave", onMouseLeave, true);
    };
}
