# iCaNova logo assets

Source sheet: `icanova-brand-sheet.png` (approved Industrial Intelligence branding).

Latest approved uploads (cropped / cut out) live in `uploads/` and are mirrored to `public/brand/`.

| File | Use |
| --- | --- |
| `logo-mark.png` | Emblem only — nav, auth, light surfaces |
| `logo-lockup-light.png` | Full lockup (white wordmark + copper A) — dark plates |
| `logo-lockup-on-dark.png` / `logo-lockup-dark.png` | Lockup with black plate removed (dark charcoal + copper A) |
| `logo-wordmark.png` | Light wordmark (cream + copper A) — large footer sunk mark |
| `logo-wordmark-dark.png` | Dark charcoal wordmark + copper A — alternate / future use |
| `logo-app-light.png` | Light-bg rounded app tile (**favicon source**) |
| `logo-app-dark.png` | Dark-bg rounded app tile |
| `logo-icon-512.png` / `logo-icon-192.png` | App / OG icons (from light tile) |
| `favicon-32.png` / `favicon-64.png` | Browser favicons (light bg) |

Regenerate from the latest uploads:

```bash
python scripts/process-brand-uploads.py
```

Or from the original sheet:

```bash
python scripts/extract-icanova-logo.py
python scripts/make-favicon.py
```

Wordmark casing in UI copy remains **iCaNova**. Lockup artwork keeps the stylized copper **A**.
