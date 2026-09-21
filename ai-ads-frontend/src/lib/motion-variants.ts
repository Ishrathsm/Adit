// Shared scroll-reveal treatment for below-the-hero sections — kept identical across
// all of them on purpose, so new sections don't each invent their own choreography.
export const fadeUpVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
} as const;

export const fadeUpTransition = { duration: 0.5, ease: [0.22, 1, 0.36, 1] } as const;

export const fadeUpViewport = { once: true, amount: 0.4 } as const;
