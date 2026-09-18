import { Router } from "express";
import type { AuthedRequest } from "../middleware/auth";
import { createAccount, getAccount } from "../lib/accounts";

export const accountRouter = Router();

accountRouter.get("/", async (req: AuthedRequest, res) => {
  try {
    const account = await getAccount(req.userId!);
    res.json({ account });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

accountRouter.post("/", async (req: AuthedRequest, res) => {
  const { accountType } = req.body ?? {};
  if (accountType !== "individual" && accountType !== "organisation") {
    res.status(400).json({ error: "accountType must be 'individual' or 'organisation'" });
    return;
  }

  try {
    const existing = await getAccount(req.userId!);
    if (existing) {
      res.status(409).json({ error: "account already set up", account: existing });
      return;
    }
    const account = await createAccount(req.userId!, accountType);
    res.status(201).json({ account });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
