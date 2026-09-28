import { type CreativeBrief, DEFAULT_BRIEF } from "../src/lib/creative-brief";
import type { BrandContext } from "../src/lib/prompt-refiner";

// Fixed test briefs for judging ad quality across changes (models, prompts, pipeline). Written the
// way a real user fills the form: a brand kit, a one-line concept, a few brief fields — so the
// writer has to do the creative work. Turito is the real delivered brand; the rest are fictional.
export interface TestBrief {
  id: string;
  category: string;
  concept: string;
  aspectRatio: string;
  brand: BrandContext;
  brief: CreativeBrief;
}

const brief = (b: Partial<CreativeBrief>): CreativeBrief => ({ ...DEFAULT_BRIEF, ...b });

export const TEST_BRIEFS: TestBrief[] = [
  {
    id: "turito",
    category: "Edtech",
    concept: "Launch film for Turito AI Academy — a personal AI tutor that takes high-school students from school academics to SAT prep and college applications at top global universities.",
    aspectRatio: "16:9",
    brand: {
      productName: "Turito",
      primaryColor: "#ed1b36",
      secondaryColor: "#ffffff",
      tagline: "Paving the way from High School to Top Global Universities",
      brandRules:
        "Characters: Indian, age 17–23. Content: simple and realistic, no animation. Design: minimal and clean, minimal colours. Lighting: bright, well-lit. Composition: plenty of negative space. Backgrounds: recognizable world-class universities. Overall feel: modern, professional, youthful, premium.",
    },
    brief: brief({
      shotCount: 5,
      shotSeconds: 6,
      tone: "premium",
      pacing: "calm",
      audience: "Indian high-school students (Grades 9–12) aiming for top global universities, and their parents",
      keyMessage: "Start your 7-day free trial today",
      avoid: "Readable text on screens or books, crowds, dark or moody scenes",
      voiceover: true,
      voiceGender: "female",
      screens: [
        {
          url: "https://cbjnnyfevxwktfmxdtqi.supabase.co/storage/v1/object/public/generated-media/turito-screen-ai-tutor.png",
          description: "Turito's AI Tutor chat: the student asks for help with linear equations in one variable, and the AI Tutor answers with a clear, structured set of study resources",
          reveal: { from: 0.35, to: 0.915 },
        },
      ],
    }),
  },
  {
    id: "biryani",
    category: "Restaurant",
    concept: "Dum Pukht House, a family-run Hyderabadi biryani restaurant in Old City — slow-cooked dum biryani, the way it has been made for three generations. Get people to visit this weekend.",
    aspectRatio: "9:16",
    brand: { productName: "Dum Pukht House", primaryColor: "#7a1f1f", secondaryColor: "#e8b04a", tagline: "Three generations of dum" },
    brief: brief({
      shotCount: 4,
      shotSeconds: 4,
      tone: "warm",
      pacing: "balanced",
      audience: "Families and food lovers in Hyderabad",
      keyMessage: "Open this weekend, 12 noon to midnight",
      onScreenText: ["Slow-cooked on dum", "Since 1968"],
    }),
  },
  {
    id: "skincare",
    category: "D2C beauty",
    concept: "Kesar Glow, a saffron face serum from a new Indian D2C skincare brand — lightweight, visible glow in two weeks. Launch ad for Instagram.",
    aspectRatio: "9:16",
    brand: {
      productName: "Kesar Glow",
      primaryColor: "#d98e04",
      secondaryColor: "#f6efe6",
      tagline: "Your glow, from saffron",
      brandRules: "Real skin, no heavy retouching. Diverse Indian skin tones. Clean, warm-neutral palette. No before/after comparisons.",
    },
    brief: brief({
      shotCount: 3,
      shotSeconds: 4,
      tone: "premium",
      pacing: "balanced",
      audience: "Women 22–35 in Indian metros who care about clean skincare",
      keyMessage: "Launch offer: 20% off this week",
      mustShow: "The serum bottle (amber glass dropper bottle) and a drop of golden serum",
    }),
  },
  {
    id: "fintech",
    category: "Fintech app",
    concept: "PaisaJar, an app that rounds up every UPI payment and saves the spare change automatically. Make saving feel effortless for young people who think they can't save.",
    aspectRatio: "9:16",
    brand: { productName: "PaisaJar", primaryColor: "#1f8a5b", secondaryColor: "#f4f1e8", tagline: "Save without trying" },
    brief: brief({
      shotCount: 4,
      shotSeconds: 4,
      tone: "playful",
      pacing: "fast",
      audience: "Young professionals and college students, 20–28, in Indian cities",
      keyMessage: "Download PaisaJar — your first ₹100 on us",
      avoid: "Phone screens with visible UI, cash piles, anything that feels like a bank ad",
      voiceover: true,
      voiceoverLanguage: "hi",
      voiceGender: "male",
    }),
  },
  {
    id: "realestate",
    category: "Real estate",
    concept: "Aranya Villas, a gated community of 48 villas on the edge of a forest reserve, 40 minutes from Bengaluru. Selling the idea of slowing down without giving up the city.",
    aspectRatio: "16:9",
    brand: {
      productName: "Aranya Villas",
      primaryColor: "#2e4a3a",
      secondaryColor: "#efe9df",
      tagline: "Live closer to the forest",
      brandRules: "Understated luxury, never flashy. Natural materials — stone, wood, glass. Real families, not models posing.",
    },
    brief: brief({
      shotCount: 5,
      shotSeconds: 6,
      tone: "trustworthy",
      pacing: "calm",
      audience: "Families in their 30s–40s working in Bengaluru tech",
      keyMessage: "Site visits open — book yours",
      contactLine: "aranyavillas.in · +91 80 4000 1234",
      voiceover: true,
      voiceGender: "female",
    }),
  },
  {
    id: "running",
    category: "Sportswear",
    concept: "Kaveri Pace, a lightweight road-running shoe from an Indian running brand, built for hot, humid morning runs.",
    aspectRatio: "9:16",
    brand: { productName: "Kaveri", primaryColor: "#ff5a1f", secondaryColor: "#111111", tagline: "Run your city" },
    brief: brief({
      shotCount: 4,
      shotSeconds: 4,
      tone: "bold",
      pacing: "fast",
      audience: "Amateur runners 25–40 in Indian cities who run before work",
      keyMessage: "Kaveri Pace — out now",
      mustShow: "The shoe in motion on a city road at dawn",
      avoid: "Stadiums, professional athletes, slow motion sweat clichés",
    }),
  },
];
