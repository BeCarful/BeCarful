"use client";

import { ContactShadows, Environment, Lightformer, OrbitControls, useGLTF } from "@react-three/drei";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ComponentRef, type RefObject } from "react";
import * as THREE from "three";
import { COMPONENT_IDS, type AggregatedDamage, type ComponentId, type Severity } from "@/types";
import { CAR_MODEL, classifyPoint, partKind } from "./car-zones";

type Props = { damage: AggregatedDamage[]; focused?: ComponentId | null; onSelect?: (id: ComponentId) => void };
type Controls = ComponentRef<typeof OrbitControls>;
type Goal = { theta: number; phi: number; radius: number; snap: boolean };
type Prepared = {
  root: THREE.Group;
  parts: Map<THREE.Mesh, { zones: Uint8Array; tint: THREE.BufferAttribute }>;
  centroids: (THREE.Vector3 | null)[];
  dispose: () => void;
};

const LENGTH = 4;
const TARGET = new THREE.Vector3(0, 0.4, 0);
const INDEX = new Map(COMPONENT_IDS.map((id, i) => [id, i]));
const TOP_VIEW = new Set<ComponentId>(["hood", "roof", "trunk", "windshield", "rear_window"]);

const axis = (a: string) => new THREE.Vector3().setComponent(a[1] === "x" ? 0 : 2, a[0] === "-" ? -1 : 1);
const FORWARD = axis(CAR_MODEL.forward);
const LEFT = axis(CAR_MODEL.left);
const START = FORWARD.clone().add(LEFT.clone().multiplyScalar(0.9)).setLength(5).setY(2.2);

type Tint = [number, number, number, number];
const rgba = (hex: string, a: number): Tint => {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b, a];
};
const SEVERITY: Record<Severity, Tint> = {
  minor: rgba("#f05252", 0.85),
  moderate: rgba("#dc2626", 0.95),
  severe: rgba("#7f1d1d", 1),
};
const FOCUS_DAMAGED = rgba("#ff5252", 1);
const FOCUS_CLEAN = rgba("#4f8cff", 0.7);
const NONE: Tint = [1, 1, 1, 0];

// Mixes the tint into the base color, mattes it and adds a little emissive so red reads on dark, metallic paint too.
function tintable(source: THREE.Material) {
  const m = source.clone();
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec4 tint;\nvarying vec4 vTint;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvTint = tint;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec4 vTint;")
      .replace("#include <color_fragment>", "#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vTint.rgb, vTint.a);")
      .replace("#include <metalnessmap_fragment>", "#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, 0.05, vTint.a);")
      .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.6, vTint.a);")
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += vTint.rgb * vTint.a * 0.3;");
  };
  m.customProgramCacheKey = () => "tint";
  return m;
}

function prepare(source: THREE.Object3D): Prepared {
  const root = new THREE.Group();
  const model = source.clone(true);
  root.add(model);
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const scale = LENGTH / Math.abs(size.dot(FORWARD));
  model.scale.multiplyScalar(scale);
  model.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
  root.updateMatrixWorld(true);

  const halfLength = LENGTH / 2;
  const halfWidth = (Math.abs(size.dot(LEFT)) * scale) / 2;
  const height = size.y * scale;
  const sums = COMPONENT_IDS.map(() => new THREE.Vector3());
  const counts = COMPONENT_IDS.map(() => 0);
  const parts: Prepared["parts"] = new Map();
  const v = new THREE.Vector3();

  model.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const names: string[] = [];
    for (let p: THREE.Object3D | null = o; p; p = p.parent) names.push(p.name);
    const materials: THREE.Material[] = Array.isArray(o.material) ? o.material : [o.material];
    const kind = partKind(names, materials.map((m) => m.name).join(" "));
    o.geometry = o.geometry.clone();
    o.material = Array.isArray(o.material) ? o.material.map(tintable) : tintable(o.material);
    const pos = o.geometry.getAttribute("position");
    const zones = new Uint8Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      const z = INDEX.get(classifyPoint({ f: v.dot(FORWARD) / halfLength, l: v.dot(LEFT) / halfWidth, h: v.y / height }, kind))!;
      zones[i] = z;
      sums[z].add(v);
      counts[z]++;
    }
    const tint = new THREE.BufferAttribute(new Float32Array(pos.count * 4), 4);
    o.geometry.setAttribute("tint", tint);
    parts.set(o, { zones, tint });
  });

  return {
    root,
    parts,
    centroids: sums.map((s, i) => (counts[i] ? s.divideScalar(counts[i]) : null)),
    dispose: () =>
      parts.forEach((_, mesh) => {
        mesh.geometry.dispose();
        (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((m) => m.dispose());
      }),
  };
}

function CarModel({
  damage,
  focused,
  onSelect,
  controlsRef,
  goalRef,
  fitRef,
  onReady,
}: Props & { controlsRef: RefObject<Controls | null>; goalRef: RefObject<Goal | null>; fitRef: RefObject<number>; onReady: () => void }) {
  const { scene } = useGLTF(CAR_MODEL.url, false);
  const car = useMemo(() => prepare(scene), [scene]);
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    onReady();
    return () => {
      car.dispose();
      document.body.style.cursor = "";
    };
  }, [car, onReady]);

  useEffect(() => {
    const byId = new Map(damage.map((d) => [d.component, d]));
    const tints = COMPONENT_IDS.map((id): Tint => {
      const d = byId.get(id);
      if (id === focused) return d ? FOCUS_DAMAGED : FOCUS_CLEAN;
      return d ? SEVERITY[d.severity] : NONE;
    });
    car.parts.forEach(({ zones, tint }) => {
      const arr = tint.array as Float32Array;
      for (let i = 0; i < zones.length; i++) arr.set(tints[zones[i]], i * 4);
      tint.needsUpdate = true;
    });
    invalidate();
  }, [car, damage, focused, invalidate]);

  useEffect(() => {
    const c = focused ? car.centroids[INDEX.get(focused)!] : null;
    if (!c) return;
    goalRef.current = {
      theta: Math.atan2(c.x, c.z),
      phi: TOP_VIEW.has(focused!) ? 0.7 : 1.15,
      radius: fitRef.current,
      snap: matchMedia("(prefers-reduced-motion: reduce)").matches,
    };
    invalidate();
  }, [car, focused, goalRef, fitRef, invalidate]);

  useFrame((state, dt) => {
    const g = goalRef.current;
    const ctl = controlsRef.current;
    if (!g || !ctl) return;
    const offset = state.camera.position.clone().sub(ctl.target);
    const s = new THREE.Spherical().setFromVector3(offset);
    const dTheta = Math.atan2(Math.sin(g.theta - s.theta), Math.cos(g.theta - s.theta));
    const k = g.snap ? 1 : 1 - Math.exp(-dt * 5);
    s.theta += dTheta * k;
    s.phi += (g.phi - s.phi) * k;
    s.radius += (g.radius - s.radius) * k;
    if (Math.abs(dTheta) < 0.002 && Math.abs(g.phi - s.phi) < 0.002 && Math.abs(g.radius - s.radius) < 0.01) goalRef.current = null;
    state.camera.position.copy(ctl.target).add(new THREE.Vector3().setFromSpherical(s));
    ctl.update();
    state.invalidate();
  });

  function click(e: ThreeEvent<MouseEvent>) {
    if (e.delta > 6 || !onSelect) return;
    e.stopPropagation();
    const part = car.parts.get(e.object as THREE.Mesh);
    if (part && e.face) onSelect(COMPONENT_IDS[part.zones[e.face.a]]);
  }

  const hover = typeof window !== "undefined" && matchMedia("(hover: hover)").matches;

  return (
    <>
      <primitive
        object={car.root}
        onClick={click}
        {...(hover && {
          onPointerOver: () => (document.body.style.cursor = "pointer"),
          onPointerOut: () => (document.body.style.cursor = ""),
        })}
      />
      <ContactShadows position={[0, 0.001, 0]} scale={LENGTH * 1.6} blur={2.4} opacity={0.55} far={2} frames={1} />
    </>
  );
}

const subscribeTheme = (cb: () => void) => {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
};
const useDark = () =>
  useSyncExternalStore(subscribeTheme, () => document.documentElement.dataset.theme === "dark", () => false);

export default function Car3D(props: Props) {
  const controlsRef = useRef<Controls | null>(null);
  const goalRef = useRef<Goal | null>(null);
  const fitRef = useRef(6);
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => {
    setReady(true);
    const ctl = controlsRef.current;
    if (!ctl) return;
    // Back off on narrow (phone) canvases so the whole car fits.
    const cam = ctl.object as THREE.PerspectiveCamera;
    fitRef.current = THREE.MathUtils.clamp(8 / cam.aspect, 5.5, 9);
    cam.position.sub(ctl.target).setLength(fitRef.current).add(ctl.target);
    ctl.update();
    ctl.saveState();
    // Vertical swipes keep scrolling the page; horizontal drags rotate the car.
    ctl.domElement?.style.setProperty("touch-action", "pan-y");
  }, []);
  const dark = useDark();
  const { credit } = CAR_MODEL;
  const link = "underline decoration-dotted underline-offset-2";

  return (
    <div className="absolute inset-0">
      <Canvas frameloop="demand" dpr={[1, 2]} gl={{ alpha: true, antialias: true }} camera={{ fov: 35, position: START.toArray() }}>
        <hemisphereLight args={["#ffffff", "#6b7a8f", dark ? 0.5 : 1.1]} />
        <directionalLight position={[4, 8, 5]} intensity={dark ? 0.7 : 2.2} color={dark ? "#b8c6ff" : "#ffffff"} />
        <Environment resolution={256} frames={1} environmentIntensity={dark ? 0.5 : 1}>
          <Lightformer form="rect" intensity={2} position={[0, 5, 0]} rotation-x={Math.PI / 2} scale={[8, 8, 1]} />
          <Lightformer form="rect" intensity={1.5} position={[-6, 2, 0]} rotation-y={Math.PI / 2} scale={[10, 3, 1]} />
          <Lightformer form="rect" intensity={1.5} position={[6, 2, 0]} rotation-y={-Math.PI / 2} scale={[10, 3, 1]} />
          <Lightformer form="rect" intensity={1} position={[0, 2, 6]} scale={[10, 3, 1]} />
        </Environment>
        <Suspense fallback={null}>
          <CarModel {...props} controlsRef={controlsRef} goalRef={goalRef} fitRef={fitRef} onReady={onReady} />
        </Suspense>
        <OrbitControls
          ref={controlsRef}
          target={TARGET}
          enablePan={false}
          enableDamping
          minDistance={3.5}
          maxDistance={11}
          minPolarAngle={0.2}
          maxPolarAngle={Math.PI / 2 - 0.08}
          onStart={() => (goalRef.current = null)}
        />
      </Canvas>
      {!ready && <p className="absolute inset-0 grid place-items-center text-sm text-ink-soft">Loading 3D car…</p>}
      <button
        type="button"
        onClick={() => {
          goalRef.current = null;
          controlsRef.current?.reset();
        }}
        className="absolute bottom-2 right-2 flex min-h-9 min-w-9 items-center justify-center gap-1 rounded-lg border border-border bg-panel/90 px-2 text-xs font-semibold text-ink sm:px-3"
      >
        <span aria-hidden className="sm:hidden">
          ↺
        </span>
        <span className="max-sm:sr-only">Reset view</span>
      </button>
      <p className="absolute bottom-2 left-2 max-w-[calc(100%-7rem)] rounded max-sm:max-w-[calc(100%-3.5rem)] bg-panel/80 px-1.5 py-0.5 text-[10px] leading-snug text-ink-soft">
        3D model
        <span className="max-sm:hidden">
          :{" "}
          <a className={link} href={credit.sourceUrl} target="_blank" rel="noopener noreferrer">
            {credit.title}
          </a>
        </span>{" "}
        by{" "}
        <a className={link} href={credit.authorUrl} target="_blank" rel="noopener noreferrer">
          {credit.author}
        </a>
        ,{" "}
        <a className={link} href={credit.licenseUrl} target="_blank" rel="noopener noreferrer">
          {credit.license}
        </a>
      </p>
    </div>
  );
}
