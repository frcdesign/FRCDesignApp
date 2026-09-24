/** Runs a task, waiting for a slot when the limiter is full. */
export type Limiter = <T>(task: () => Promise<T>) => Promise<T>;

/** Queues the rest in call order, so a rate-limit burst only hits the running few. */
export function createLimiter(max: number): Limiter {
    let active = 0;
    const queue: (() => void)[] = [];

    const release = () => {
        active--;
        const next = queue.shift();
        if (next) next();
    };

    return async <T>(task: () => Promise<T>): Promise<T> => {
        if (active >= max) {
            await new Promise<void>((resolve) => queue.push(resolve));
        }
        active++;
        try {
            return await task();
        } finally {
            release();
        }
    };
}
