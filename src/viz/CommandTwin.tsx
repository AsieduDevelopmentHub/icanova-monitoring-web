import { Suspense, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, Environment, OrbitControls } from "@react-three/drei";

export type TwinStatus = "running" | "stopped" | "warning" | "fault" | "offline" | "unknown";

type TwinProps = {
  status: TwinStatus;
  label: string;
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

function GeneratorRig({ status }: { status: TwinStatus }) {
  const color = statusColor(status);
  const running = status === "running";
  return (
    <group position={[0, -0.2, 0]}>
      <mesh position={[0, 0.06, 0]} receiveShadow castShadow>
        <boxGeometry args={[2.8, 0.12, 1.25]} />
        <meshStandardMaterial color="#1a222c" metalness={0.55} roughness={0.4} />
      </mesh>
      <mesh position={[-0.35, 0.58, 0]} castShadow>
        <boxGeometry args={[1.7, 0.9, 1.05]} />
        <meshStandardMaterial color="#3a4a56" metalness={0.42} roughness={0.38} />
      </mesh>
      <mesh position={[-0.35, 1.08, 0]} castShadow>
        <boxGeometry args={[1.55, 0.12, 0.92]} />
        <meshStandardMaterial color="#2f3d48" metalness={0.5} roughness={0.32} />
      </mesh>
      <mesh position={[1.05, 0.52, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.42, 0.42, 0.85, 32]} />
        <meshStandardMaterial color="#4e6270" metalness={0.62} roughness={0.28} />
      </mesh>
      <mesh position={[1.05, 0.52, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.18, 0.18, 0.92, 16]} />
        <meshStandardMaterial color="#263746" metalness={0.7} roughness={0.25} />
      </mesh>
      <mesh position={[-0.85, 1.35, -0.28]}>
        <cylinderGeometry args={[0.07, 0.09, 0.7, 14]} />
        <meshStandardMaterial color="#70808a" metalness={0.65} roughness={0.28} />
      </mesh>
      <mesh position={[-0.85, 1.72, -0.28]}>
        <cylinderGeometry args={[0.1, 0.08, 0.12, 14]} />
        <meshStandardMaterial color="#637b83" metalness={0.55} roughness={0.35} />
      </mesh>
      <mesh position={[0.15, 0.72, 0.54]}>
        <boxGeometry args={[0.55, 0.35, 0.08]} />
        <meshStandardMaterial color="#263746" metalness={0.35} roughness={0.45} />
      </mesh>
      <mesh position={[1.05, 1.05, 0]}>
        <sphereGeometry args={[0.09, 20, 20]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={running ? 1.6 : 0.5}
          roughness={0.3}
        />
      </mesh>
      {running ? (
        <mesh position={[1.05, 0.52, 0]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.48, 0.018, 10, 40]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.55} />
        </mesh>
      ) : null}
    </group>
  );
}

function TwinScene({ status }: { status: TwinStatus }) {
  return (
    <>
      <color attach="background" args={["#0c1218"]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[5, 7, 4]} intensity={1.25} castShadow />
      <directionalLight position={[-3, 2, -2]} intensity={0.35} />
      <GeneratorRig status={status} />
      <ContactShadows position={[0, -0.2, 0]} opacity={0.5} scale={7} blur={2.2} />
      <Environment preset="warehouse" />
      <OrbitControls
        enablePan={false}
        minDistance={3.4}
        maxDistance={6.5}
        maxPolarAngle={Math.PI / 2.15}
        target={[0.15, 0.45, 0]}
        autoRotate={status === "running"}
        autoRotateSpeed={0.28}
      />
    </>
  );
}

/** Restrained engineering twin — Canvas only; parent handles reduced-motion fallback. */
export function CommandTwin({ status, label }: TwinProps) {
  const caption = useMemo(() => `${label} · ${status}`, [label, status]);
  return (
    <div className="cc-twin-stage" role="img" aria-label={caption}>
      <Suspense fallback={<p className="cc-twin-caption">Loading…</p>}>
        <Canvas camera={{ position: [3.2, 2.0, 3.6], fov: 36 }} dpr={[1, 1.5]}>
          <TwinScene status={status} />
        </Canvas>
      </Suspense>
      <p className="cc-twin-caption">{caption}</p>
    </div>
  );
}
