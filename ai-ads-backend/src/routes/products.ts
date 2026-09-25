import { Router } from "express";
import multer from "multer";
import type { AuthedRequest } from "../middleware/auth";
import { completeQuestionnaire, createProduct, getProduct, listProducts } from "../lib/products";
import { uploadLogo } from "../lib/storage";

export const productsRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

productsRouter.get("/", async (req: AuthedRequest, res) => {
  try {
    const products = await listProducts(req.userId!);
    res.json({ products });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

productsRouter.post("/", async (req: AuthedRequest, res) => {
  const { name } = req.body ?? {};
  if (typeof name !== "string" || !name.trim()) {
    res.status(400).json({ error: "name is required" });
    return;
  }

  try {
    const product = await createProduct(req.userId!, name.trim());
    res.status(201).json({ product });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

productsRouter.get("/:id", async (req: AuthedRequest, res) => {
  try {
    const product = await getProduct(req.userId!, req.params.id);
    if (!product) {
      res.status(404).json({ error: "product not found" });
      return;
    }
    res.json({ product });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

productsRouter.post("/:id/logo", upload.single("logo"), async (req: AuthedRequest, res) => {
  if (!req.file) {
    res.status(400).json({ error: "logo file is required" });
    return;
  }

  try {
    const product = await getProduct(req.userId!, req.params.id);
    if (!product) {
      res.status(404).json({ error: "product not found" });
      return;
    }

    const extension = req.file.originalname.split(".").pop() || "png";
    const logoUrl = await uploadLogo(product.id, req.file.buffer, req.file.mimetype, extension);
    res.json({ logoUrl });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

productsRouter.patch("/:id/questionnaire", async (req: AuthedRequest, res) => {
  const { name, font, brandRules, logoUrl, primaryColor, secondaryColor, tagline } = req.body ?? {};
  if (name !== undefined && name !== null && (typeof name !== "string" || name.trim().length > 80)) {
    res.status(400).json({ error: "name must be a string of at most 80 characters" });
    return;
  }
  // Font and rules are optional so a brand kit can be skipped or filled in gradually; the pipeline
  // falls back to the tone's font and no extra rules. The kit counts as complete once both are set.
  for (const [field, value] of [["font", font], ["brandRules", brandRules]] as const) {
    if (value !== undefined && value !== null && typeof value !== "string") {
      res.status(400).json({ error: `${field} must be a string` });
      return;
    }
  }

  try {
    const product = await completeQuestionnaire(req.userId!, req.params.id, {
      name: typeof name === "string" && name.trim() ? name.trim() : null,
      font: typeof font === "string" && font.trim() ? font.trim() : null,
      brandRules: typeof brandRules === "string" && brandRules.trim() ? brandRules.trim() : null,
      logoUrl: logoUrl || null,
      primaryColor: primaryColor || null,
      secondaryColor: secondaryColor || null,
      tagline: tagline || null,
    });
    res.json({ product });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
