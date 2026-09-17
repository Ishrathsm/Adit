import { createApp } from "./app";
import { env } from "./lib/env";

const app = createApp();

app.listen(env.port, () => {
  console.log(`ai-ads-backend listening on port ${env.port} (${env.nodeEnv})`);
});
