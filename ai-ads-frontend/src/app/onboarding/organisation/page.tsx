"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Building2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { createProduct, listProducts, type Product } from "@/lib/api";

export default function OrganisationProductPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[] | null>(null);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listProducts()
      .then(({ products }) => setProducts(products))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  function handleSelect(product: Product) {
    if (product.questionnaire_completed) {
      router.push(`/projects?product=${product.id}`);
    } else {
      router.push(`/onboarding/brand-questionnaire?product=${product.id}`);
    }
  }

  async function handleCreate() {
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const { product } = await createProduct(name.trim());
      router.push(`/onboarding/brand-questionnaire?product=${product.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setCreating(false);
    }
  }

  return (
    <main className="relative mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 flex justify-center overflow-hidden"
      >
        <div
          className="h-[420px] w-[720px] opacity-15 blur-[110px] dark:opacity-30"
          style={{
            background:
              "radial-gradient(closest-side, rgba(99,140,255,0.55), rgba(198,99,255,0.35) 45%, rgba(255,99,170,0.2) 70%, transparent 80%)",
          }}
        />
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push("/projects")}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft size={14} />
          Back
        </button>
        <ThemeToggle />
      </div>

      <div className="mt-8 flex flex-col gap-2">
        <p className="text-xs font-medium tracking-[0.2em] text-muted uppercase">Organisation</p>
        <h1 className="text-2xl font-semibold tracking-tight">Which product is this for?</h1>
        <p className="text-sm text-muted">
          Each product gets its own brand kit and its own Projects, so ads never mix branding.
        </p>
      </div>

      {error && (
        <p className="mt-6 rounded-2xl border border-border-strong bg-surface px-4 py-3 text-sm text-red-400">
          {error}
        </p>
      )}

      {products && products.length > 0 && (
        <div className="mt-8 flex flex-col gap-3">
          {products.map((product) => (
            <button
              key={product.id}
              onClick={() => handleSelect(product)}
              className="rgb-border flex items-center gap-3 p-5 text-left transition-opacity hover:opacity-90"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border-strong">
                <Building2 size={16} />
              </div>
              <div>
                <h2 className="text-sm font-medium">{product.name}</h2>
                <p className="text-xs text-muted">
                  {product.questionnaire_completed ? "Brand kit ready" : "Brand questionnaire pending"}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="rgb-border mt-8 flex flex-col gap-3 p-5">
        <label htmlFor="product-name" className="text-sm font-medium">
          New product
        </label>
        <input
          id="product-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleCreate();
          }}
          placeholder="e.g. Nike Air Max, Acme Cold Brew"
          className="rounded-full border border-border-subtle bg-background px-4 py-2.5 text-sm outline-none placeholder:text-muted focus:border-border-strong"
        />
        <Button onClick={handleCreate} disabled={creating || !name.trim()} className="self-start">
          <Plus size={14} />
          {creating ? "Creating…" : "Create product"}
        </Button>
      </div>
    </main>
  );
}
