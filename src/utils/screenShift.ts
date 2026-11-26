const SHELL_SELECTORS = [
    '.yorumi-app-content',
    '.yorumi-mobile-navbar',
    '.yorumi-mobile-top-actions',
] as const;

const EASING = 'cubic-bezier(0.25, 1, 0.5, 1)';

export const shiftMobileShell = (px: number, dragging: boolean, durationMs = 230) => {
    const transition = dragging ? 'none' : `transform ${durationMs}ms ${EASING}`;
    const transform = px !== 0 ? `translateX(${px}px)` : '';
    for (const selector of SHELL_SELECTORS) {
        const el = document.querySelector<HTMLElement>(selector);
        if (!el) continue;
        el.style.transition = transition;
        el.style.transform = transform;
    }
};

export const resetMobileShellShift = () => {
    for (const selector of SHELL_SELECTORS) {
        const el = document.querySelector<HTMLElement>(selector);
        if (!el) continue;
        el.style.transition = '';
        el.style.transform = '';
    }
};
