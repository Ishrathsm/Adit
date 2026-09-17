# AI Ads Pipeline — Backend / Orchestration

In-house orchestration service for the AI Ads Pipeline. Calls third-party model APIs for the heavy lifting (video/image generation, TTS/voice) and stitches results into finished ads.

Full product plan / PRD: see the Notion docs
- [AI Ads Pipeline - Product Plan](https://app.notion.com/p/3dd42b30a762811980fedc2ea803f949) (source planning notes)
- [AI Ads Pipeline - v1 PRD](https://app.notion.com/p/3de42b30a76281c39c0fd1684f851a7f) (consolidated spec)

## Status

Scaffolding stage — Node.js + TypeScript (Express), confirmed 2026-09-17 (follows from BullMQ,
already locked in as the queue library, being Node-only). `GET /health` reports Supabase and
queue connectivity — both verified live against the real Supabase project and Upstash Redis
(TCP connection, eviction disabled per BullMQ's own guidance so job data can't be silently
dropped under memory pressure). Actual job/worker logic isn't written yet — no providers
(Veo/Runway/Kling/ElevenLabs) are wired into the pipeline.

```
npm install
npm run dev     # tsx watch, http://localhost:4000
npm run build   # tsc -> dist/
npm start       # node dist/index.js
```

## Responsibilities (v1)

- Orchestrate calls to third-party model providers (e.g. Runway, Kling, Veo, ElevenLabs) for image/video/voice generation
- Storyboard workflow: generate 3 choice images per shot, handle per-shot re-pick without regenerating other shots
- Post-generation brand asset application: logo watermark + tagline overlay (no per-brand model fine-tuning)
- Platform preset handling: fixed aspect ratio + duration per output preset
- Credit/usage metering per generation call, for the subscription + pay-as-you-go monetization model
- Fallback path (future): GPU rental + open-source models where cheaper/more controllable at scale

## Open items blocking implementation details

- Cost per workflow not yet modeled (needed for credit metering logic)
- Provider selection per generation type not yet finalized
