"use client";

import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";

import { CAR_LENGTH, CAR_MODEL_URL } from "@/lib/car/car-config";
import { createPaintMaterial } from "@/lib/car/car-materials";

import { ProceduralCar } from "./procedural-car";

const PAINT_MATERIAL_NAME = /paint|body/i;

type CarModelProps = {
  areDoorsOpen: boolean;
};

/**
 * Shows the real .glb car when CAR_MODEL_URL is set, otherwise the procedural placeholder.
 */
export function CarModel({ areDoorsOpen }: CarModelProps) {
  if (CAR_MODEL_URL) {
    return <GltfCar url={CAR_MODEL_URL} />;
  }
  return <ProceduralCar areDoorsOpen={areDoorsOpen} />;
}

/**
 * Finds the mesh that uses the car paint.
 *
 * Why: downloaded models name materials inconsistently. We first look for a
 * "paint"/"body" material name, then fall back to the mesh with the largest
 * bounding box, which is almost always the body shell.
 */
export function findPaintMeshes(root: THREE.Object3D): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  root.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      meshes.push(child);
    }
  });

  const namedPaintMeshes = meshes.filter((mesh) => {
    const meshMaterials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];
    return meshMaterials.some((material) =>
      PAINT_MATERIAL_NAME.test(material.name),
    );
  });
  if (namedPaintMeshes.length > 0) {
    return namedPaintMeshes;
  }

  const sizeOf = (mesh: THREE.Mesh) =>
    new THREE.Box3().setFromObject(mesh).getSize(new THREE.Vector3()).length();
  const largestMesh = meshes.reduce<THREE.Mesh | null>(
    (largest, mesh) =>
      !largest || sizeOf(mesh) > sizeOf(largest) ? mesh : largest,
    null,
  );
  return largestMesh ? [largestMesh] : [];
}

/**
 * Loads a .glb, repaints the body white and scales it to the XL7's real length,
 * standing on the ground and centered on the origin.
 */
function GltfCar({ url }: { url: string }) {
  const { scene } = useGLTF(url);

  const preparedScene = useMemo(() => {
    const car = scene.clone(true);
    const paint = createPaintMaterial();
    for (const mesh of findPaintMeshes(car)) {
      mesh.material = paint;
    }

    const bounds = new THREE.Box3().setFromObject(car);
    const size = bounds.getSize(new THREE.Vector3());
    const scale = CAR_LENGTH / Math.max(size.x, size.z);
    car.scale.setScalar(scale);

    const scaledBounds = new THREE.Box3().setFromObject(car);
    const center = scaledBounds.getCenter(new THREE.Vector3());
    car.position.set(-center.x, -scaledBounds.min.y, -center.z);
    return car;
  }, [scene]);

  return <primitive object={preparedScene} />;
}
