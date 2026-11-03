import { Navigate, useParams } from "react-router";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { DEMO_GENERATOR_ID } from "../telemetry/logModel";
import { PageSkeleton } from "../ui/Skeleton";
import { siteGeneratorPath, siteGatewayPath, sitePath } from "./paths";

/** Legacy /generators → Sites directory. */
export function RedirectGeneratorsIndex() {
  return <Navigate to="/sites" replace />;
}

/** Legacy /gateways → Sites directory. */
export function RedirectGatewaysIndex() {
  return <Navigate to="/sites" replace />;
}

/** Legacy /generators/:id[/:section] → /sites/:siteId/generators/:id. */
export function RedirectLegacyGenerator() {
  const { id: key, section } = useParams();
  if (!key) {
    return <Navigate to="/sites" replace />;
  }
  if (key === DEMO_GENERATOR_ID || !import.meta.env.VITE_CONVEX_URL) {
    return <Navigate to={siteGeneratorPath("demo", key, section)} replace />;
  }
  return <ResolveGeneratorRedirect publicKey={key} section={section} />;
}

function ResolveGeneratorRedirect({ publicKey, section }: { publicKey: string; section?: string }) {
  const resolved = useQuery(api.generators.resolveKey, { key: publicKey });
  if (resolved === undefined) {
    return <PageSkeleton rows={3} label="Opening generator" />;
  }
  if (resolved === null || !resolved.siteId) {
    return <Navigate to="/sites" replace />;
  }
  return (
    <Navigate
      to={siteGeneratorPath(String(resolved.siteId), String(resolved.generatorId ?? publicKey), section)}
      replace
    />
  );
}

/** Legacy /gateways/:id → /sites/:siteId/gateways/:id. */
export function RedirectLegacyGateway() {
  const { id: key } = useParams();
  if (!key) {
    return <Navigate to="/sites" replace />;
  }
  if (key === DEMO_GENERATOR_ID || !import.meta.env.VITE_CONVEX_URL) {
    return <Navigate to={siteGatewayPath("demo", key)} replace />;
  }
  return <ResolveGatewayRedirect publicKey={key} />;
}

function ResolveGatewayRedirect({ publicKey }: { publicKey: string }) {
  const detail = useQuery(api.devices.detailForKey, { key: publicKey });
  if (detail === undefined) {
    return <PageSkeleton rows={3} label="Opening gateway" />;
  }
  if (detail === null) {
    return <Navigate to="/sites" replace />;
  }
  const siteId = detail.device.siteId;
  if (!siteId) {
    return <Navigate to="/sites" replace />;
  }
  const key = detail.device.identity || publicKey;
  return <Navigate to={siteGatewayPath(String(siteId), key)} replace />;
}

/** /sites/demo/... without Convex stays on nested demo routes (handled by detail pages). */
export function RedirectMissingSite() {
  return <Navigate to={sitePath("demo")} replace />;
}
