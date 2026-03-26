# Future Enhancements

## Camp Scan Mode (Planned)

### Goal
Add a scan-assisted mode inside an existing camp checklist (`/camps/[id]`) so leaders can scan multiple item QR labels and build a camp plan quickly.

### Scope (v1)
- Add scan mode to `islands/CampChecklist.tsx` (within existing add modes)
- Require an existing camp first (no auto-create from first scan)
- Support external scanner / QR app input first (no browser camera in v1)
- Ignore duplicate scans (do not increment quantity)
- Reuse existing `PATCH /api/camps/[id]` validation and side-effect rules

### Supported Scan Input Formats
- Relative QR path: `/inventory/{itemId}/scan`
- Absolute URL containing that path
- Raw item UUID

### Proposed Phases
1. Add scan mode state and UI panel in `CampChecklist`.
2. Add parser/normalizer for accepted scan formats.
3. Resolve scanned item IDs from `allItems`; show clear error for unknown items.
4. Add valid unique items to plan using existing `patch({ items })` flow.
5. Keep scan input focused and show per-scan feedback (`Added`, `Already in plan`, `Unknown QR`, `Not available`).
6. Optional bridge from `/inventory/[id]/scan` into checklist scan mode.
7. Optional CTA after camp creation to open scan mode directly.
8. Mobile polish, role checks, and regression verification.

### Verification
1. Scan 5+ valid labels into one camp; confirm unique items are added.
2. Re-scan an existing item; confirm duplicate is ignored.
3. Scan invalid/unknown input; confirm no mutation and clear feedback.
4. Confirm pack/return/template/status flows remain unchanged.
5. Confirm food vs non-food behavior still follows server rules.
6. Confirm viewer role has no scan-add capability.
7. Run `deno check` for touched files and relevant camp tests.

### Relevant Files
- `islands/CampChecklist.tsx`
- `routes/camps/[id].tsx`
- `routes/camps/new.tsx`
- `routes/inventory/[id]/scan.tsx`
- `routes/api/camps/[id].ts`
- `types/inventory.ts`
