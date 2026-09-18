import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Google's client libraries only know how to read a service account key from a file path
// (GOOGLE_APPLICATION_CREDENTIALS). Railway (and most non-GCP hosts) have no persistent file
// storage for secrets, only env vars — so we accept the key's JSON content directly via
// GOOGLE_APPLICATION_CREDENTIALS_JSON, write it to a temp file once at boot, and point the
// standard env var at it. Locally, GOOGLE_APPLICATION_CREDENTIALS (a real file path) still
// works unchanged. This must be imported before any module that constructs a GoogleGenAI client.
if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  const credentialsPath = join(tmpdir(), "gcp-service-account.json");
  writeFileSync(credentialsPath, process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON, { mode: 0o600 });
  process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;
}
