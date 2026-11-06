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
- Use “Site ID” as the visible label for the site’s public identifier. Operational site and asset views with tabular data provide PDF, CSV, and Excel exports; CSV/Excel export the current filtered or loaded rows, while PDF uses the browser print layout to preserve the page’s actual charts, status colors, and visual hierarchy without application navigation chrome.
- Use consistent page spacing and clear grouping, not a separate bordered card for every value.
- Use readable table headings and compact but scannable rows. Keep dense information available on mobile through intentional responsive behavior rather than shrinking text indiscriminately.
- Filters should be visibly associated with their result set; loading, empty, failure, offline, stale, and zero states must remain distinct.
- Maintain keyboard access, visible focus, semantic labels, reduced-motion support, and contrast across both themes.
- Prefer a simple 2D monitoring path for known gateway, controller-link, generator, and telemetry states. Do not depict unmeasured energy flow or imply that an illustrative equipment model is a live physical twin. If retained, 3D is a small, clearly labeled supporting illustration, not the primary monitoring view.

### Site detail hierarchy

- Keep the default Site view focused: identity, telemetry freshness, a compact operating snapshot, and a clear per-generator readings table.
- Separate Generators, Gateways, and Site Info into their own site sections instead of stacking every detail onto the overview. Site Info is the concise administrative record for identity, zone/region/cluster, address and classifications, SIM/customer references, field engineer/contact, installation date, coordinates, communication mode, assigned operator and note, and the site's on-air-since time. Users with site-management permission can edit it; coordinate data remains available to maps and gateway location updates.
- Show measured phase voltage, current, power factor, and kW alongside load, engine hours (HRM), fuel, and starts in the Site overview and Generators section. The Generators section may add supporting measured electrical and engine readings. Preserve quality/missing states; never turn an absent measurement into zero.
- Do not paginate current site readings. Keep all returned readings visible and disclose when the backend caps the result.
- Site roster cards show exact last-activity timestamps, fuel level, and HRM instead of generator count; desktop roster rows include fuel and HRM columns too.
- Site roster exports follow the active search, filters, sort order, and map/list result set. Generator and gateway detail views link back to the Site ID and to the relevant site equipment sections.
- Site roster values repaint from the live Convex subscription every 30 seconds while preserving the roster order.
- On mobile, site cards start collapsed and expand from a labeled disclosure control. Sites and the Command Center share a hidden-by-default Filter & Search sheet with search, searchable checkbox multi-selects for region, power source, update state, and site status, fuel threshold, and searchable sort; it opens as a side sheet on desktop and a bottom sheet on mobile.
- Site power parameters use one row per phase and a single voltage cell showing active-source voltage; generator power factor uses the controller value or is calculated server-side from measured active/apparent phase power. Generator and mains current/PF/kW are shown only when supported for the active source. Site detail cards show measured continuous generator-run and mains-availability duration, resetting the displayed interval after telemetry goes stale.
- Site monthly source metrics are calculated server-side for the current calendar month. Generator energy and run hours use the DSE controller's cumulative energy-export and engine-hour counters. Mains energy remains N/A without a mains kWh meter; mains run hours count intervals between consecutive fresh samples only while mains voltage is present and the generator is stopped. This is observed source time, not a controller-provided cumulative mains-hour counter; gaps beyond the telemetry freshness window are excluded.
- Show gateway health and only the identity/version information needed to identify a monitored asset. Keep map coordinates in Site Info rather than giving location a separate site-detail tab.
- Disclose capped site lists. Cursor-paginated history should provide truthful older/newer navigation without inventing a total or last page.

## Responsive review

Check the app at desktop, tablet, and narrow mobile widths (at minimum around 390px and 720px). Verify the shell/drawer, page actions, filters, table overflow or alternate layout, dialogs, and pagination. Avoid horizontal page overflow and never hide essential operational status.

## Acceptance

- Brand palette and theme behavior remain intact.
- Existing routes, permissions, and operational data meaning are preserved.
- The Command Center dashboard and marketing page content are not changed by the app refresh.
- New or updated UI states have appropriate loading, empty, error, offline, and responsive behavior.
- Browser verification and automated checks are reported separately and truthfully.
