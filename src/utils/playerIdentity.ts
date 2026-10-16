export const arePlayerAnimeIdsEquivalent = (
    first: string | number | null | undefined,
    second: string | number | null | undefined
): boolean => {
    const left = String(first ?? '').trim().toLowerCase();
    const right = String(second ?? '').trim().toLowerCase();
    if (!left || !right) return false;
    return left === right;
};
