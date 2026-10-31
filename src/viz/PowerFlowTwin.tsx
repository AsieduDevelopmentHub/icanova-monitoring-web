import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Environment, Line, OrbitControls, Text } from "@react-three/drei";
import type { Group } from "three";
import { CatmullRomCurve3, Vector3 } from "three";
import type { TwinStatus } from "./CommandTwin";
import { derivePowerFlow, flowPathColor, type PowerFlowInput, type PowerFlowState } from "./powerFlowModel";

type Props = {
  flow?: PowerFlowState;
  input?: PowerFlowInput;
};

function statusColor(status: TwinStatus): string {
  switch (status) {
    case "running":
      return "#24845b";
    case "warning":
      return "#d18a26";
    case "fault":
      return "#c64747";
    case "offline":
      return "#707780";
    case "stopped":
      return "#637b83";
    default:
      return "#b8babc";
  }
}

function BoxNode({
  position,
  size,
  color,
  emissive,
  intensity = 0,
  label,
}: {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  emissive?: string;
  intensity?: number;
  label?: string;
}) {
  return (
    <group position={position}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial
          color={color}
          metalness={0.45}
          roughness={0.38}
          emissive={emissive ?? color}
          emissiveIntensity={intensity}
        />
      </mesh>
      {label ? (
        <Text
          position={[0, size[1] / 2 + 0.12, 0]}
          fontSize={0.11}
          color="#d8d9d7"
          anchorX="center"
          anchorY="bottom"
          maxWidth={1.2}
        >
          {label}
        </Text>
      ) : null}
    </group>
  );
}

function GeneratorCore({ status }: { status: TwinStatus }) {
  const color = statusColor(status);
  const running = status === "running";
  return (
    <group>
      <mesh position={[0, 0.05, 0]} receiveShadow castShadow>
        <boxGeometry args={[1.35, 0.1, 0.85]} />
        <meshStandardMaterial color="#1a222c" metalness={0.55} roughness={0.4} />
      </mesh>
      <mesh position={[-0.12, 0.42, 0]} castShadow>
        <boxGeometry args={[0.95, 0.62, 0.72]} />
        <meshStandardMaterial color="#3a4a56" metalness={0.42} roughness={0.38} />
      </mesh>
      <mesh position={[0.55, 0.38, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.28, 0.28, 0.55, 24]} />
        <meshStandardMaterial color="#4e6270" metalness={0.62} roughness={0.28} />
      </mesh>
      <mesh position={[0.55, 0.72, 0]}>
        <sphereGeometry args={[0.07, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={running ? 1.5 : 0.4}
          roughness={0.3}
        />
      </mesh>
    </group>
  );
}

function FlowParticles({
  curve,
  color,
  active,
  count = 14,
}: {
  curve: CatmullRomCurve3;
  color: string;
  active: boolean;
  count?: number;
}) {
  const group = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!group.current || !active) return;
    const t0 = (clock.getElapsedTime() * 0.22) % 1;
    group.current.children.forEach((child, i) => {
      const t = (t0 + i / count) % 1;
      const p = curve.getPoint(t);
      child.position.copy(p);
    });
  });
  if (!active) return null;
  return (
    <group ref={group}>
      {Array.from({ length: count }, (_, i) => (
        <mesh key={i}>
          <sphereGeometry args={[0.035, 10, 10]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.4} />
        </mesh>
      ))}
    </group>
  );
}

function PathLine({
  curve,
  color,
  opacity,
}: {
  curve: CatmullRomCurve3;
  color: string;
  opacity: number;
}) {
  const points = useMemo(() => curve.getPoints(48).map((p) => p.toArray() as [number, number, number]), [curve]);
  return (
    <Line
      points={points}
      color={color}
      lineWidth={2.5}
      transparent
      opacity={opacity}
      depthWrite={false}
    />
  );
}

function PowerScene({ state }: { state: PowerFlowState }) {
  const pathColor = flowPathColor(state.flowMode);
  const opacity =
    state.flowMode === "blocked" || state.flowMode === "fault"
      ? 0.28
      : state.flowMode === "stale"
        ? 0.5
        : 0.9;

  const mainCurve = useMemo(
    () =>
      new CatmullRomCurve3([
        new Vector3(-2.4, 0.35, 0),
        new Vector3(-1.35, 0.35, 0),
        new Vector3(-0.2, 0.4, 0),
        new Vector3(1.05, 0.55, 0),
        new Vector3(2.15, 0.45, 0),
      ]),
    [],
  );
  const battCurve = useMemo(
    () =>
      new CatmullRomCurve3([
        new Vector3(0.15, 0.25, 0),
        new Vector3(0.55, -0.05, 0.35),
        new Vector3(1.05, -0.15, 0.55),
      ]),
    [],
  );

  const gwColor = state.gatewayOnline === false ? "#707780" : "#477ca8";
  const linkColor = state.linkOk === false ? "#c64747" : state.linkOk === true ? "#24845b" : "#637b83";

  return (
    <>
      <color attach="background" args={["#0c1218"]} />
      <ambientLight intensity={0.32} />
      <directionalLight position={[5, 7, 4]} intensity={1.15} castShadow />
      <directionalLight position={[-4, 2, -2]} intensity={0.3} />

      <BoxNode position={[-2.4, 0.35, 0]} size={[0.55, 0.4, 0.4]} color={gwColor} label="Gateway" />
      <BoxNode position={[-1.35, 0.35, 0]} size={[0.45, 0.32, 0.32]} color={linkColor} label="Link" />

      <group position={[-0.15, 0, 0]}>
        <GeneratorCore status={state.twinStatus} />
        <Text position={[0, 1.05, 0]} fontSize={0.12} color="#d8d9d7" anchorX="center">
          Generator
        </Text>
      </group>

      <BoxNode
        position={[1.05, 0.55, 0]}
        size={[0.42, 0.32, 0.32]}
        color={state.voltageL1 != null ? "#a8754d" : "#637b83"}
        emissive={state.voltageL1 != null ? "#a8754d" : "#637b83"}
        intensity={state.voltageL1 != null ? 0.35 : 0}
        label="AC"
      />
      <BoxNode
        position={[1.05, -0.15, 0.55]}
        size={[0.38, 0.28, 0.28]}
        color={state.batteryV != null ? "#24845b" : "#637b83"}
        intensity={state.batteryV != null ? 0.25 : 0}
        label="Batt"
      />
      <BoxNode
        position={[2.15, 0.45, 0]}
        size={[0.48, 0.42, 0.42]}
        color={state.animateFlow ? "#24845b" : "#637b83"}
        emissive={state.animateFlow ? "#24845b" : "#637b83"}
        intensity={state.animateFlow ? 0.55 : 0.1}
        label="Load"
      />
      {state.powerKw != null ? (
        <Text position={[2.15, 0.05, 0]} fontSize={0.1} color="#a8754d" anchorX="center" anchorY="top">
          {`${state.powerKw.toFixed(state.powerKw >= 100 ? 0 : 1)} kW`}
        </Text>
      ) : null}

      <PathLine curve={mainCurve} color={pathColor} opacity={opacity} />
      <PathLine curve={battCurve} color={pathColor} opacity={opacity * 0.75} />
      <FlowParticles curve={mainCurve} color="#a8754d" active={state.animateFlow} />
      <FlowParticles curve={battCurve} color="#24845b" active={state.animateFlow} count={8} />

      <ContactShadows position={[0, -0.35, 0]} opacity={0.45} scale={9} blur={2.4} />
      <Environment preset="warehouse" />
      <OrbitControls
        enablePan={false}
        minDistance={4.2}
        maxDistance={8}
        maxPolarAngle={Math.PI / 2.1}
        target={[0, 0.35, 0]}
        autoRotate={state.animateFlow}
        autoRotateSpeed={0.22}
      />
    </>
  );
}

/** R3F site/generator power-flow twin — Canvas only; parent handles flat fallback. */
export function PowerFlowTwin({ flow, input }: Props) {
  const state = useMemo(() => flow ?? (input ? derivePowerFlow(input) : null), [flow, input]);
  if (!state) {
    return null;
  }
  const caption = `${state.label} · ${state.caption}`;
  return (
    <div className="cc-twin-stage is-power-flow" role="img" aria-label={caption}>
      <Suspense fallback={<p className="cc-twin-caption">Loading…</p>}>
        <Canvas camera={{ position: [3.8, 2.4, 4.2], fov: 34 }} dpr={[1, 1.5]}>
          <PowerScene state={state} />
        </Canvas>
      </Suspense>
      <p className="cc-twin-caption">{state.caption}</p>
    </div>
  );
}
