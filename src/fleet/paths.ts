/** Site-centric URL helpers — assets live under their site. */

export function sitePath(siteId: string): string {
  return `/sites/${siteId}`;
}

export function siteGeneratorPath(siteId: string, generatorId: string, section?: string): string {
  const base = `/sites/${siteId}/generators/${generatorId}`;
  return section ? `${base}/${section}` : base;
}

export function siteGatewayPath(siteId: string, gatewayKey: string): string {
  return `/sites/${siteId}/gateways/${gatewayKey}`;
}

export function siteAlarmsPath(siteId: string): string {
  return `/alarms?site=${encodeURIComponent(siteId)}`;
}

export function siteEventsPath(siteId: string): string {
  return `/events?site=${encodeURIComponent(siteId)}`;
}

export function siteTrendsPath(siteId: string, generatorId?: string): string {
  const params = new URLSearchParams({ site: siteId });
  if (generatorId) {
    params.set("generator", generatorId);
  }
  return `/trends?${params.toString()}`;
}

export function siteMaintenancePath(siteId: string): string {
  return `/maintenance?site=${encodeURIComponent(siteId)}`;
}
