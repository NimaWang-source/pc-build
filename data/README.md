# Taiwan Workstation Dataset

Dataset file:

- `workstation-dataset.tw-2026q2.json`

Purpose:

- Seed data for workstation PC selector
- Taiwan / TWD pricing context
- Blender + Gaussian Splatting workload guidance
- Compatibility-first structure for later frontend use

## Notes

- Snapshot date: `2026-04-22`
- DRAM / SSD prices highly volatile in Taiwan Q2 2026
- Some RAM / storage / cooler / case entries are **market-band** or **derived** estimates, not live single-SKU quotes
- `assemblyOnly: true` means source research found bundle-only / 組裝限定 behavior in market

## Recommended frontend usage

- Use `parts` as catalog source
- Use `compatibilityRules` for validation copy and UX warnings
- Use `referenceBuilds` for preset buttons like:
  - 入門 Blender
  - 平衡型
  - GS 推薦單卡

## Important fields

- `price.minTwd` / `price.maxTwd`: current known market band
- `price.confidence`: `high | medium | low`
- `price.volatility`: `low | medium | high | critical`
- `compatibility`: matching keys for selectors
- `specs.notes`: human-readable recommendation copy

## Safe assumptions for later UI

- Gaussian Splatting path assumes **NVIDIA + CUDA**
- 24GB VRAM is recommended target
- 64GB RAM is practical minimum for GS workstation
- 128GB RAM is better for large scenes or multitasking

## Follow-up files worth adding later

- `frontend-data.ts` normalized lookup maps
- `compatibility.ts` pure validation functions
- `presets.ts` UI-ready preset definitions
- live price refresh script from Feebee / BigGo / Coolpc quote snapshots
