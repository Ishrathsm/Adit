// Shared scroll-reveal treatment for below-the-hero sections — kept identical across
// all of them on purpose, so new sections don't each invent their own choreography.
export const fadeUpVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
} as const;

export const fadeUpTransition = { duration: 0.9, ease: [0.16, 1, 0.3, 1] } as const;

// "some" (any overlap at all, not a fixed 20%/40% ratio) triggers the fade as soon as a
// section starts entering the viewport — on a fast mobile flick that's the difference
// between the animation having the whole scroll-in to play out versus popping in only
// once a larger fraction has already scrolled past.
export const fadeUpViewport = { once: true, amount: "some" } as const;
