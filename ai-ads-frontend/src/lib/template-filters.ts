import type { AspectRatio, Template } from "./api";

export const ORIENTATIONS = ["Landscape", "Portrait", "Square"] as const;
export type Orientation = (typeof ORIENTATIONS)[number];

export function orientationOf(ratio: AspectRatio): Orientation {
  const [w, h] = ratio.split(":").map(Number);
  if (w === h) return "Square";
  return w > h ? "Landscape" : "Portrait";
}

export const FORMATS = ["Poster", "Billboard", "Social Media"] as const;
export type Format = (typeof FORMATS)[number];

// A ratio's real-world use: 1:1 reads as a social post, a wide ratio as an outdoor/banner
// billboard, everything else (tall or boxy) as a standalone poster.
export function formatOf(ratio: AspectRatio): Format {
  if (ratio === "1:1") return "Social Media";
  if (ratio === "16:9" || ratio === "21:9" || ratio === "3:2") return "Billboard";
  return "Poster";
}

// There's no stored category for a template — this is a hand-built lookup from each template's
// own name, covering every template in the library today. A name this doesn't recognise falls
// back to "Other" rather than being miscategorised.
const CATEGORY_BY_NAME: Record<string, string> = {
  "AI & Technology Billboard": "Technology",
  "Automobile & Car Billboard": "Automotive",
  "Bold Geometric Sale Billboard": "Retail & Sales",
  "Burger & Fast Food Billboard": "Food & Beverage",
  "Cafe Beverages Billboard": "Food & Beverage",
  "Chocolate & Confectionery Billboard": "Food & Beverage",
  "Community & Social Initiative Billboard": "Community & Social",
  "Company Milestones & Corporate Timeline": "Business & Corporate",
  "Conceptual Quote & Metaphor": "Business & Corporate",
  "Construction & Infrastructure Billboard": "Real Estate & Construction",
  "Consumer Technology Billboard": "Technology",
  "Corporate Innovation & Business Solutions": "Business & Corporate",
  "Creative & Design Agency Billboard": "Business & Corporate",
  "Desserts & Ice Cream Billboard": "Food & Beverage",
  "Diagonal Split Sale Billboard": "Retail & Sales",
  "Digital Payments & Fintech Billboard": "Finance",
  "E-commerce Flash Sale": "Retail & Sales",
  "E-commerce Platform Billboard": "Retail & Sales",
  "Editorial Hero Spotlight Billboard": "Fashion & Lifestyle",
  "Education & Academic Programs Billboard": "Education",
  "Educational & Study Tips": "Education",
  "Electronics & Gadgets Billboard": "Technology",
  "Employee Work Anniversary": "Business & Corporate",
  "Energy Drink Billboard": "Food & Beverage",
  "Entertainment & Media Billboard": "Entertainment & Sports",
  "Festival Wishes": "Celebrations & Greetings",
  "Finance & Banking Billboard": "Finance",
  "Food & Restaurant Promotion": "Food & Beverage",
  "Footwear Billboard": "Fashion & Lifestyle",
  "Fried Chicken & Fast Food Billboard": "Food & Beverage",
  "Gourmet Burger Restaurant Billboard": "Food & Beverage",
  "Health Insurance & Protection": "Health & Wellness",
  "Health Services & Wellness Billboard": "Health & Wellness",
  "Healthcare Billboard": "Health & Wellness",
  "Home Care & Household Products Billboard": "Home & Household",
  "Instant Food Billboard": "Food & Beverage",
  "Minimal Fast Food Billboard": "Food & Beverage",
  "Motorcycle Billboard": "Automotive",
  "Quick Commerce Billboard": "Retail & Sales",
  "Real Estate & Property Promotion": "Real Estate & Construction",
  "Recruitment & Hiring": "Business & Corporate",
  "Refreshment Drinks Billboard": "Food & Beverage",
  "Restaurant Billboard": "Food & Beverage",
  "SaaS & CRM Software Billboard": "Technology",
  "Seasonal Sale & Offer": "Retail & Sales",
  "Snacks & Chips Billboard": "Food & Beverage",
  "Social Media & Digital Marketing": "Business & Corporate",
  "Sports & Recreation Billboard": "Entertainment & Sports",
  "Telecom & Communication Billboard": "Technology",
  "Travel & Tourism Promotion": "Travel & Tourism",
  "Universal Promotional Banner": "Retail & Sales",
  // Video templates.
  "Course Promo Film": "Education",
  "Family Moment Story": "Food & Beverage",
  "Folk-Tale Animated Legend": "Food & Beverage",
  "Slow-Motion Product Film": "Beauty & Personal Care",
  "Smooth Ride Vehicle Film": "Automotive",
};
const FALLBACK_CATEGORY = "Other";

export function categoryOf(name: string): string {
  return CATEGORY_BY_NAME[name] ?? FALLBACK_CATEGORY;
}

export const CATEGORIES = Array.from(new Set(Object.values(CATEGORY_BY_NAME))).sort();

export interface TemplateFilters {
  orientations: Orientation[];
  formats: Format[];
  category: string | null;
}

export const EMPTY_FILTERS: TemplateFilters = { orientations: [], formats: [], category: null };

export function filtersFromSearchParams(params: URLSearchParams): TemplateFilters {
  const orientations = (params.get("orientation")?.split(",").filter(Boolean) ?? []) as Orientation[];
  const formats = (params.get("format")?.split(",").filter(Boolean) ?? []) as Format[];
  const category = params.get("category") || null;
  return { orientations, formats, category };
}

export function searchParamsFromFilters(filters: TemplateFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.orientations.length) params.set("orientation", filters.orientations.join(","));
  if (filters.formats.length) params.set("format", filters.formats.join(","));
  if (filters.category) params.set("category", filters.category);
  return params;
}

export function matchesFilters(template: Template, filters: TemplateFilters): boolean {
  if (filters.orientations.length && !filters.orientations.includes(orientationOf(template.aspect_ratio))) return false;
  if (filters.formats.length && !filters.formats.includes(formatOf(template.aspect_ratio))) return false;
  if (filters.category && categoryOf(template.name) !== filters.category) return false;
  return true;
}
