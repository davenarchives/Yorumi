import type { Transition, Variants } from 'framer-motion';

const softEase: [number, number, number, number] = [0.22, 1, 0.36, 1];

export const gentleTransition: Transition = {
    duration: 0.28,
    ease: softEase,
};

export const pageTransitionVariants: Variants = {
    initial: { opacity: 0, y: 8 },
    animate: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.32, ease: softEase },
        transitionEnd: { transform: 'none' },
    },
    exit: {
        opacity: 0,
        y: -6,
        transition: { duration: 0.18, ease: softEase },
    },
};

export const cardItemVariants: Variants = {
    initial: { opacity: 0, y: 10 },
    animate: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.34, ease: softEase },
    },
};

const dropdownVariants: Variants = {
    initial: { opacity: 0, y: -6, scale: 0.98 },
    animate: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: { duration: 0.18, ease: softEase },
    },
    exit: {
        opacity: 0,
        y: -4,
        scale: 0.98,
        transition: { duration: 0.14, ease: softEase },
    },
};

const modalBackdropVariants: Variants = {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: 0.2, ease: softEase } },
    exit: { opacity: 0, transition: { duration: 0.16, ease: softEase } },
};

const modalPanelVariants: Variants = {
    initial: { opacity: 0, y: 12, scale: 0.97 },
    animate: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: { duration: 0.24, ease: softEase },
    },
    exit: {
        opacity: 0,
        y: 8,
        scale: 0.98,
        transition: { duration: 0.16, ease: softEase },
    },
};

const listContainerVariants: Variants = {
    animate: {
        transition: {
            staggerChildren: 0.035,
            delayChildren: 0.04,
        },
    },
};

export const pressMotion = {
    scale: 0.98,
};
