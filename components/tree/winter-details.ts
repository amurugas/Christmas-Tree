import {
  BoxGeometry, CanvasTexture, CircleGeometry, CylinderGeometry, Group,
  InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial,
  PlaneGeometry, PointLight, SphereGeometry, SRGBColorSpace, TorusGeometry,
  Vector3, type Scene,
} from "three";
import { GROUND_Y } from "../../lib/tree/geometry.ts";

function softLightTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const context = canvas.getContext("2d")!;
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, "rgba(255,205,111,0.65)");
  gradient.addColorStop(0.35, "rgba(255,184,89,0.25)");
  gradient.addColorStop(1, "rgba(255,184,89,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

export function addWinterDetails(scene: Scene) {
  const lanternLights: PointLight[] = [];
  const glowTexture = softLightTexture();
  const iron = new MeshStandardMaterial({ color: "#303d40", metalness: 0.7, roughness: 0.48 });
  const candleMaterial = new MeshBasicMaterial({ color: "#ffe0a0" });
  for (const [x, z] of [[-5.9, 2.4], [5.7, 1.8]]) {
    const lantern = new Group();
    lantern.position.set(x, GROUND_Y, z);
    const base = new Mesh(new BoxGeometry(0.5, 0.1, 0.5), iron);
    base.position.y = 0.05;
    lantern.add(base);
    const roof = new Mesh(new CylinderGeometry(0.08, 0.38, 0.22, 4), iron);
    roof.position.y = 0.86;
    roof.rotation.y = Math.PI / 4;
    lantern.add(roof);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const bar = new Mesh(new CylinderGeometry(0.022, 0.022, 0.64, 6), iron);
      bar.position.set(sx * 0.2, 0.42, sz * 0.2);
      lantern.add(bar);
    }
    const candle = new Mesh(new CylinderGeometry(0.09, 0.09, 0.3, 12), candleMaterial);
    candle.position.y = 0.29;
    lantern.add(candle);
    const flame = new Mesh(new SphereGeometry(0.07, 10, 8), candleMaterial);
    flame.scale.y = 1.7;
    flame.position.y = 0.51;
    lantern.add(flame);
    const handle = new Mesh(new TorusGeometry(0.12, 0.018, 5, 16), iron);
    handle.position.y = 1.05;
    lantern.add(handle);
    const light = new PointLight("#ffc477", 3.6, 5, 2);
    light.position.y = 0.55;
    lantern.add(light);
    lanternLights.push(light);
    const pool = new Mesh(new PlaneGeometry(3.5, 3.5),
      new MeshBasicMaterial({ map: glowTexture, transparent: true, depthWrite: false, opacity: 0.65 }));
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = 0.008;
    lantern.add(pool);
    lantern.traverse((object) => { if (object instanceof Mesh && object !== pool) object.castShadow = true; });
    scene.add(lantern);
  }

  const footprintMaterial = new MeshBasicMaterial({ color: "#6e7892", transparent: true, opacity: 0.24, depthWrite: false });
  const footprintGeometry = new CircleGeometry(1, 12);
  // Paired tracks curve toward the snowman; a smaller set disappears into the forest.
  for (const [startX, endX, startZ, endZ, count, size] of [
    [-8.6, -6.3, 6.2, -2.4, 13, 0.11],
    [7.6, 8.8, 0.4, -7, 10, 0.075],
  ]) {
    for (let i = 0; i < count; i += 1) {
      const t = i / (count - 1);
      const x = startX + (endX - startX) * t + Math.sin(t * Math.PI) * 0.5;
      const z = startZ + (endZ - startZ) * t;
      const footprint = new Mesh(footprintGeometry, footprintMaterial);
      footprint.rotation.set(-Math.PI / 2, 0, -0.2);
      footprint.scale.set(size, size * 2, 1);
      footprint.position.set(x + (i % 2 ? 0.18 : -0.18), GROUND_Y + 0.012, z);
      scene.add(footprint);
    }
  }

  return {
    update(time: number) {
      lanternLights.forEach((light, i) => {
        light.intensity = 3.6 + Math.sin(time * 1.8 + i * 3) * 0.13 + Math.sin(time * 3.7 + i) * 0.06;
      });
    },
  };
}

export function createArrivalSparkles(parent: Group) {
  const mesh = new InstancedMesh(new SphereGeometry(1, 6, 4),
    new MeshBasicMaterial({ color: "#ffe3a0", transparent: true, opacity: 0.8, depthWrite: false }), 48);
  mesh.frustumCulled = false;
  mesh.visible = false;
  parent.add(mesh);
  let started = -Infinity;
  const origin = new Vector3();
  const matrix = new Matrix4();
  return {
    burst(position: readonly [number, number, number]) {
      origin.set(...position);
      origin.y -= 0.25;
      started = performance.now() / 1000;
      mesh.visible = true;
    },
    update(time: number) {
      const age = time - started;
      if (age > 2.4) {
        mesh.visible = false;
        return false;
      }
      for (let i = 0; i < 48; i += 1) {
        const angle = i * 2.399;
        const radius = 0.12 + age * (0.12 + (i % 7) * 0.045);
        const size = Math.max(0, 1 - age / 2.4) * (0.014 + (i % 3) * 0.008);
        matrix.makeScale(size, size, size);
        matrix.setPosition(origin.x + Math.cos(angle) * radius,
          origin.y + Math.sin(i * 1.7) * radius + age * 0.2,
          origin.z + Math.sin(angle) * radius);
        mesh.setMatrixAt(i, matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      return true;
    },
  };
}
