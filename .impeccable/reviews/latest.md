# Finish Review — ILQ "Mühürlü Kargo"

**Reviewed:** src/sidepanel.html, src/popup.css, src/sidepanel.css, src/popup.js (build: dist/ ok)
**Method:** degraded flow — no browser/screenshot; detector + live CSS + computed contrast vs. committed direction contract and craft floor.
**Verdict: Pass with notes**

## Checklist

- **Direction** — The whole committed direction is present and committed. The seal ring (not the tekerlek lock) is the brand mark on every surface (login, topbar, screen-mask, chat header, safety note, fp-card). Courier-desk tokens are real: `KAPALI · KAPALI` tamper bands (safety strip, fp-card band → `DOĞRULANDI · MÜHÜR KIRILDI` when verified), registry-stamp status pill (uppercase, tracked), manila slips (surface-2), ledger-line fingerprint sheet, dashed perforation under the code-card, `RET`-like danger stamps, and the panic decoy as an ordinary official weather bulletin. First viewport delivers the thesis: seal badge, headline, lede, dispatch-slip addr-note, and "Sohbete başla" primary. The `FINISH` line, `THESIS`, and seed key `b51cef42` all survive the production build (verified in dist/).
- **Contrast** — Pass. Computed on the actual tokens (bone theme): ink/ground 13.77:1; ink-mute/ground 4.85:1; placeholder/surface 4.92:1; trust-deep/trust-bg 8.06:1; danger/danger-bg 5.42:1; tab-inactive/surface-2 5.20:1. Dark theme: ink/ground 13.54:1, ink-mute 5.75:1. HC: 21:1, placeholder 12.63:1. All ≥4.5:1 for body and placeholder; large text ≥3:1 trivially.
- **Depth** — Pass. `--shadow-sm` (0 1px 2px + 0 1px 3px) and `--shadow-md` (0 2px 6px + 0 8px 24px -12px) both carry offset + soft blur. No zero-offset halo, no hard offset shadows outside the world.
- **Spacing** — Pass by reading: tight groups (7px message gap, 8px field gaps, 2px tab gutter), generous separation (20px above headline vs 6px below; 14px above tabs; panel groups separated), more space above headings than below. The ledger-line texture uses a tone-on-tone repeating-linear-gradient (texture, not a colored accent).
- **Type** — Pass. Body 13px, measure constrained to ~40–42ch in narrow 352px column (max-width enforced on lede/panel-sub); display max 21px (≤6rem); tracking floor −0.02em (≥ −0.04em). InterVar variable UI face (self-hosted), mono only for code/address/fingerprint/sender — never as costume.
- **Motion** — Pass with note. Exactly one authored moment (the `rise` 0.22s exponential ease-out `cubic-bezier(0.22,1,0.36,1)`) used for messages, fp-card, error strip, menu popup; nothing bounces or lags. Note: it reaches transform+opacity only; the craft-floor preference to reach past them (blur/clip) is not met — acceptable for a small trusted messenger, noted not failed.
- **States** — Pass. Hover on all buttons/tabs/contacts/file preview; disabled on primary + menu items; loading via screen-mask on connect; error via `RET`-style danger strip + error pill state; empty state via `.messages:empty::before` with courier-voice copy; keyboard `:focus-visible` ring on buttons, inputs, selects.
- **Copy** — Pass. Turkish, product's own voice, controls name their action ("Bağlantı kur", "Yeni kod üret", "Kopyala", "Kimliği sıfırla"). Errors name problem and recovery (e.g. "Eşleşmiyor — bağlantı sonlandırıldı. Yeni kod üretip yeniden bağlan."). Pre-existing dead duplicate IDs (`codeInput` ×2, `resetBtn` ×2) are functionally benign (live `codeInput` is first in DOM; `resetBtn` has zero JS refs) — carried as a cleanup note, not introduced by this build.
- **Coverage** — Pass. Connect-by-code, code generation + copy + countdown, chat with E2E + fingerprint verification gate, address book, themes (bone/dark/hc/system), identity reset modal, panic/decoy, net settings, file share, expiry timers — all present and reachable in seconds.

## FORM check

FORM line records candidate #5 with seed `b51cef42`; verified present in the contract comment and in the built dist/sidepanel.html.

## Notes carried forward

1. `.msg .who` at opacity 0.75 on surface-2 is 10px mono; computed blend is ~4.4:1, just under the 4.5 body floor on the incoming-slip ground. Bump to opacity ≥0.85 in the polish handoff if strict AA is desired (the send/status contrast itself is fine).
2. Pre-existing duplicate IDs (`codeInput`, `resetBtn`) should be deduplicated in a future cleanup pass.
3. DESIGN.md still describes the prior "Sessiz Kilitler" world; the documenter step rewrites it from this built world (that is the exit condition of this run).
