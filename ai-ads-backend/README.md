# AI Ads Pipeline — Backend / Orchestration

In-house orchestration service for the AI Ads Pipeline. Calls third-party model APIs for the heavy lifting (video/image generation, TTS/voice) and stitches results into finished ads.

Full product plan / PRD: see the Notion docs
- [AI Ads Pipeline - Product Plan](https://app.notion.com/p/3dd42b30a762811980fedc2ea803f949) (source planning notes)
- [AI Ads Pipeline - v1 PRD](https://app.notion.com/p/3de42b30a76281c39c0fd1684f851a7f) (consolidated spec)

## Status

Scaffolding stage — framework not yet chosen. Candidates under consideration: Node/TypeScript, Python (FastAPI).

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
