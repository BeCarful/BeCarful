"use client";

import {
  ContactShadows,
  Environment,
  Lightformer,
  OrbitControls,
} from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { type ComponentRef, Suspense, useEffect, useRef } from "react";

import { CarModel } from "./car-model";

const BACKGROUND_COLOR = "#eef0f3";
const CAMERA_START_POSITION: [number, number, number] = [5.5, 2.4, 5.5];
const CAMERA_TARGET: [number, number, number] = [0, 0.8, 0];

type CarSceneProps = {
  isAutoRotating: boolean;
  areDoorsOpen: boolean;
  resetToken: number;
};

/**
 * The WebGL canvas: studio lighting, soft ground shadow, orbit camera and the car.
 */
export default function CarScene({
  isAutoRotating,
  areDoorsOpen,
  resetToken,
}: CarSceneProps) {
  const controlsRef = useRef<ComponentRef<typeof OrbitControls>>(null);

  useEffect(() => {
    const controls = controlsRef.current;
    if (resetToken === 0 || !controls) {
      return;
    }
    // Why: controls.reset() restores the state saved when the controls were
    // created, which is before drei applies the target prop, so it would look
    // at the ground. Setting both explicitly always returns to our start view.
    // An update with damping off first flushes leftover drag momentum, which
    // would otherwise keep spinning the camera away after the reset.
    controls.enableDamping = false;
    controls.update();
    controls.object.position.set(...CAMERA_START_POSITION);
    controls.target.set(...CAMERA_TARGET);
    controls.update();
    controls.enableDamping = true;
  }, [resetToken]);

  return (
    <Canvas camera={{ position: CAMERA_START_POSITION, fov: 40 }} dpr={[1, 2]}>
      <color attach="background" args={[BACKGROUND_COLOR]} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 8, 5]} intensity={1.2} />

      {/* Why: a studio environment built from light panels gives the white clearcoat
          soft reflections without downloading an HDR file at runtime. */}
      <Environment resolution={256}>
        <Lightformer
          form="rect"
          intensity={2}
          position={[0, 6, 0]}
          rotation-x={Math.PI / 2}
          scale={[12, 6, 1]}
        />
        <Lightformer
          form="rect"
          intensity={1.5}
          position={[-6, 2, 0]}
          rotation-y={Math.PI / 2}
          scale={[10, 3, 1]}
        />
        <Lightformer
          form="rect"
          intensity={1.5}
          position={[6, 2, 0]}
          rotation-y={-Math.PI / 2}
          scale={[10, 3, 1]}
        />
        <Lightformer
          form="rect"
          intensity={1}
          position={[0, 2, 6]}
          scale={[10, 3, 1]}
        />
      </Environment>

      <Suspense fallback={null}>
        <CarModel areDoorsOpen={areDoorsOpen} />
      </Suspense>

      <ContactShadows
        position={[0, 0, 0]}
        opacity={0.45}
        scale={10}
        blur={2.5}
        far={3}
      />

      <OrbitControls
        ref={controlsRef}
        target={CAMERA_TARGET}
        enablePan={false}
        minDistance={4}
        maxDistance={12}
        maxPolarAngle={(85 * Math.PI) / 180}
        autoRotate={isAutoRotating}
        autoRotateSpeed={0.8}
        enableDamping
      />
    </Canvas>
  );
}
