import { createApp } from "./app";
import { env } from "./lib/env";
import { ensureBrandAssetsBucket } from "./lib/storage";

const app = createApp();

app.listen(env.port, () => {
  console.log(`ai-ads-backend listening on port ${env.port} (${env.nodeEnv})`);
});

ensureBrandAssetsBucket().catch((err) => console.error("failed to ensure brand-assets bucket:", err));
