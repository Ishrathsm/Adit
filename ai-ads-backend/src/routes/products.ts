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
  const { font, brandRules, logoUrl, primaryColor, secondaryColor, tagline } = req.body ?? {};
  if (typeof font !== "string" || !font.trim() || typeof brandRules !== "string" || !brandRules.trim()) {
    res.status(400).json({ error: "font and brandRules are required" });
    return;
  }

  try {
    const product = await completeQuestionnaire(req.userId!, req.params.id, {
      font: font.trim(),
      brandRules: brandRules.trim(),
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
