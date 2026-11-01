import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Environment, OrbitControls } from "@react-three/drei";
import type { Group } from "three";

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

/** Recognizable packaged genset: skid, canopy, alternator, radiator, exhaust, panel, fuel. */
function GeneratorRig({ status }: { status: TwinStatus }) {
  const color = statusColor(status);
  const running = status === "running";
  const fan = useRef<Group>(null);
  useFrame((_, delta) => {
    if (fan.current && running) {
      fan.current.rotation.z += delta * 8;
    }
  });

  return (
    <group position={[0, -0.15, 0]}>
      {/* Base frame / skid */}
      <mesh position={[0, 0.05, 0]} receiveShadow castShadow>
        <boxGeometry args={[3.2, 0.1, 1.35]} />
        <meshStandardMaterial color="#1a222c" metalness={0.55} roughness={0.42} />
      </mesh>
      <mesh position={[-1.35, 0.12, 0.55]} castShadow>
        <boxGeometry args={[0.35, 0.14, 0.18]} />
        <meshStandardMaterial color="#2a3440" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[1.35, 0.12, 0.55]} castShadow>
        <boxGeometry args={[0.35, 0.14, 0.18]} />
        <meshStandardMaterial color="#2a3440" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[-1.35, 0.12, -0.55]} castShadow>
        <boxGeometry args={[0.35, 0.14, 0.18]} />
        <meshStandardMaterial color="#2a3440" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[1.35, 0.12, -0.55]} castShadow>
        <boxGeometry args={[0.35, 0.14, 0.18]} />
        <meshStandardMaterial color="#2a3440" metalness={0.5} roughness={0.4} />
      </mesh>

      {/* Acoustic canopy / enclosure */}
      <mesh position={[-0.25, 0.62, 0]} castShadow>
        <boxGeometry args={[1.9, 0.95, 1.12]} />
        <meshStandardMaterial color="#3a4a56" metalness={0.4} roughness={0.4} />
      </mesh>
      <mesh position={[-0.25, 1.14, 0]} castShadow>
        <boxGeometry args={[1.78, 0.1, 1.0]} />
        <meshStandardMaterial color="#2f3d48" metalness={0.48} roughness={0.34} />
      </mesh>
      {/* Louvers */}
      {[-0.55, -0.25, 0.05].map((x) => (
        <mesh key={x} position={[x, 0.7, 0.57]}>
          <boxGeometry args={[0.22, 0.55, 0.03]} />
          <meshStandardMaterial color="#263746" metalness={0.35} roughness={0.5} />
        </mesh>
      ))}

      {/* Alternator */}
      <mesh position={[1.15, 0.55, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.44, 0.44, 0.95, 32]} />
        <meshStandardMaterial color="#4e6270" metalness={0.62} roughness={0.28} />
      </mesh>
      <mesh position={[1.15, 0.55, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.2, 0.2, 1.02, 16]} />
        <meshStandardMaterial color="#263746" metalness={0.7} roughness={0.25} />
      </mesh>
      <mesh position={[1.65, 0.55, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.28, 0.32, 0.12, 24]} />
        <meshStandardMaterial color="#637b83" metalness={0.55} roughness={0.35} />
      </mesh>

      {/* Radiator / cooling pack */}
      <mesh position={[-1.35, 0.62, 0]} castShadow>
        <boxGeometry args={[0.35, 0.85, 1.05]} />
        <meshStandardMaterial color="#4a5a66" metalness={0.45} roughness={0.45} />
      </mesh>
      <group ref={fan} position={[-1.35, 0.62, 0]}>
        <mesh rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[0.28, 0.035, 10, 24]} />
          <meshStandardMaterial color="#70808a" metalness={0.5} roughness={0.35} />
        </mesh>
        <mesh>
          <boxGeometry args={[0.5, 0.06, 0.04]} />
          <meshStandardMaterial color="#a8b0b6" metalness={0.4} roughness={0.4} />
        </mesh>
      </group>

      {/* Exhaust stack */}
      <mesh position={[-0.75, 1.45, -0.28]} castShadow>
        <cylinderGeometry args={[0.07, 0.09, 0.75, 14]} />
        <meshStandardMaterial color="#70808a" metalness={0.65} roughness={0.28} />
      </mesh>
      <mesh position={[-0.75, 1.88, -0.28]}>
        <cylinderGeometry args={[0.11, 0.08, 0.14, 14]} />
        <meshStandardMaterial color="#637b83" metalness={0.55} roughness={0.35} />
      </mesh>

      {/* Fuel tank */}
      <mesh position={[0.35, 0.28, -0.42]} castShadow>
        <boxGeometry args={[1.1, 0.32, 0.42]} />
        <meshStandardMaterial color="#2a3440" metalness={0.4} roughness={0.48} />
      </mesh>

      {/* Control panel */}
      <mesh position={[0.2, 0.78, 0.58]} castShadow>
        <boxGeometry args={[0.58, 0.4, 0.08]} />
        <meshStandardMaterial color="#1e2832" metalness={0.35} roughness={0.45} />
      </mesh>
      <mesh position={[0.05, 0.85, 0.63]}>
        <boxGeometry args={[0.22, 0.16, 0.02]} />
        <meshStandardMaterial color="#0c1218" metalness={0.2} roughness={0.6} emissive="#1a3040" emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[0.32, 0.88, 0.63]}>
        <sphereGeometry args={[0.035, 12, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={running ? 1.8 : 0.55} />
      </mesh>
      <mesh position={[0.32, 0.76, 0.63]}>
        <sphereGeometry args={[0.028, 12, 12]} />
        <meshStandardMaterial
          color={status === "fault" || status === "warning" ? color : "#3a4a56"}
          emissive={status === "fault" || status === "warning" ? color : "#000"}
          emissiveIntensity={status === "fault" || status === "warning" ? 1.2 : 0}
        />
      </mesh>

      {/* Status beacon on alternator */}
      <mesh position={[1.15, 1.12, 0]}>
        <sphereGeometry args={[0.09, 20, 20]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={running ? 1.6 : 0.45}
          roughness={0.3}
        />
      </mesh>
      {running ? (
        <mesh position={[1.15, 0.55, 0]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.5, 0.016, 10, 40]} />
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
      <ContactShadows position={[0, -0.15, 0]} opacity={0.5} scale={8} blur={2.2} />
      <Environment preset="warehouse" />
      <OrbitControls
        enablePan={false}
        minDistance={3.6}
        maxDistance={7}
        maxPolarAngle={Math.PI / 2.1}
        target={[0.05, 0.5, 0]}
        autoRotate={status === "running"}
        autoRotateSpeed={0.22}
      />
    </>
  );
}

/** Packaged genset twin — Canvas only; parent handles reduced-motion fallback. */
export function CommandTwin({ status, label }: TwinProps) {
  const caption = useMemo(() => `${label} · ${status}`, [label, status]);
  return (
    <div className="cc-twin-stage" role="img" aria-label={caption}>
      <Suspense fallback={<p className="cc-twin-caption">Loading generator model…</p>}>
        <Canvas camera={{ position: [3.4, 2.1, 3.8], fov: 34 }} dpr={[1, 1.5]} shadows>
          <TwinScene status={status} />
        </Canvas>
      </Suspense>
      <p className="cc-twin-caption">{caption}</p>
    </div>
  );
}
