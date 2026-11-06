# iCaNova Monitoring app UI system

## Scope

This system guides the authenticated application surfaces: Monitor, Analyze, Operate, Administration, and the shared application shell. Marketing pages are out of scope. The `/app` Command Center dashboard content remains unchanged; shared shell updates may appear around it.

## Visual direction

Keep the established industrial palette and typography in `src/styles.css`:

- Graphite navigation and chrome; warm-white light workspace; deep-navy dark surfaces.
- Muted copper for primary actions and active navigation; steel for quiet/inactive states.
- Reserve red, amber, green, and blue for their existing alarm, warning, success, and information meanings.
- Continue using Manrope for display, Inter for body, and IBM Plex Mono for technical values and operational metadata.

Do not introduce a new palette, generic admin-dashboard styling, decorative gradients that compete with data, or competitor logos/visual identity.

## Competitive reference

The competitor screenshots indexed in `competitor-inspiration/README.md` are an Invendis/American Tower-style operations-console benchmark, not a component specification. Learn from:

- Fleet tables that keep useful operational fields visible.
- Site-detail layouts that separate trends, equipment state, and electrical facts.
- A legible source-to-load energy-flow story when supported by measured system data.

Improve on their spreadsheet-heavy feel and equal-weight tile mosaics. Do not copy their layout, typography, colors, branding, or unverified device fields. The Phase 11 plan is authoritative for equipment and telemetry truth: cloud, Modbus, and sample freshness are separate; missing measurements are not zero; visuals must not imply unmeasured power flow.

## App interaction and information hierarchy

- Preserve shell navigation, page-title ownership, routes, access controls, and existing workflows unless the task explicitly changes them.
- Monitoring answers what is happening, what needs attention, and how conditions are changing. Gateway identity/configuration, raw protocol diagnostics, and provisioning belong in the developer platform; the monitoring app should show only gateway health and identity/version details needed to understand availability.
- Put the main task and its primary action first; keep context and supporting actions easy to locate.
- Use consistent page spacing and clear grouping, not a separate bordered card for every value.
- Use readable table headings and compact but scannable rows. Keep dense information available on mobile through intentional responsive behavior rather than shrinking text indiscriminately.
- Filters should be visibly associated with their result set; loading, empty, failure, offline, stale, and zero states must remain distinct.
- Maintain keyboard access, visible focus, semantic labels, reduced-motion support, and contrast across both themes.
- Prefer a simple 2D monitoring path for known gateway, controller-link, generator, and telemetry states. Do not depict unmeasured energy flow or imply that an illustrative equipment model is a live physical twin. If retained, 3D is a small, clearly labeled supporting illustration, not the primary monitoring view.

### Site detail hierarchy

- Start with the site identity, code/region, telemetry freshness, and one set of site shortcuts.
- Put the operational board before secondary setup context; do not repeat the same shortcuts inside the status strip.
- Show gateway health and only the identity/version information needed to identify the monitored asset; keep location as supporting site context after the operational view.
- Disclose capped gateway results rather than implying the visible list is complete. Do not invent totals for cursor-paginated data.

## Responsive review

Check the app at desktop, tablet, and narrow mobile widths (at minimum around 390px and 720px). Verify the shell/drawer, page actions, filters, table overflow or alternate layout, dialogs, and pagination. Avoid horizontal page overflow and never hide essential operational status.

## Acceptance

- Brand palette and theme behavior remain intact.
- Existing routes, permissions, and operational data meaning are preserved.
- The Command Center dashboard and marketing page content are not changed by the app refresh.
- New or updated UI states have appropriate loading, empty, error, offline, and responsive behavior.
- Browser verification and automated checks are reported separately and truthfully.
