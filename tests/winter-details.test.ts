import assert from "node:assert/strict";
import test from "node:test";
import { Group, InstancedMesh, Matrix4 } from "three";
import { createArrivalSparkles } from "../components/tree/winter-details.ts";

test("arrival sparkles stay hidden until an upload and expire after their brief burst", () => {
  const parent = new Group();
  const sparkles = createArrivalSparkles(parent);
  const mesh = parent.children[0] as InstancedMesh;
  assert.equal(mesh.visible, false);
  assert.equal(sparkles.update(performance.now() / 1000), false);

  sparkles.burst([2, 3, 4]);
  const now = performance.now() / 1000;
  assert.equal(sparkles.update(now + 0.5), true);
  assert.equal(mesh.visible, true);
  const matrix = new Matrix4();
  for (let i = 0; i < mesh.count; i += 1) {
    mesh.getMatrixAt(i, matrix);
    assert.ok(matrix.elements.every(Number.isFinite));
    assert.ok(Math.abs(matrix.elements[12] - 2) < 1);
  }
  assert.equal(sparkles.update(now + 3), false);
  assert.equal(mesh.visible, false);
  sparkles.burst([-2, 1, 0]);
  assert.equal(sparkles.update(performance.now() / 1000 + 0.1), true);
  mesh.geometry.dispose();
  (mesh.material as { dispose(): void }).dispose();
  mesh.dispose();
});
