/**
 * Shared, framework-free foliage envelopes and ornament scale. Branches,
 * hanging anchors, and camera framing derive from the same tier dimensions.
 *
 * Coordinates are tree-local scene units, Y-up, with the tree's axis at x = z = 0.
 * Angles around the trunk use `atan2(x, z)` (0 faces +Z), which is the
 * convention three.js' ConeGeometry uses for its vertices.
 */

import { MAX_ORNAMENT_INCHES, METRES_PER_INCH } from "../ornaments/types.ts";

/** The largest ornament the contract allows (tolerance aside), in metres. */
export const STANDARD_ORNAMENT_METRES = MAX_ORNAMENT_INCHES * METRES_PER_INCH;
/** Scene size of a 4" ornament: the tree's standard ornament size. */
export const STANDARD_ORNAMENT_SPAN = 0.72;
/** One scale for every ornament: a 4" (0.1016 m) ornament spans 0.72 units. */
export const SCENE_UNITS_PER_METRE = STANDARD_ORNAMENT_SPAN / STANDARD_ORNAMENT_METRES;

/** Radial segments of each foliage cone (low-poly on purpose). */
export const CONE_SEGMENTS = 18;

export type ConeTier = {
  /** Radius of the cone's lower rim. */
  radius: number;
  height: number;
  /** Y of the lower rim (the branch tips). */
  baseY: number;
  /** Rotation of the cone mesh around Y, so tiers don't line up. */
  rotationY: number;
};

const TIER_COUNT = 8;
const LOWEST_RADIUS = 4;
const RADIUS_STEP = 0.36;
const LOWEST_HEIGHT = 2;
const HEIGHT_STEP = 0.1;
const LOWEST_RIM_Y = -3.45;
const LOWEST_RISE = 1.4;
const RISE_STEP = 0.02;

function buildTiers(): ConeTier[] {
  const tiers: ConeTier[] = [];
  let baseY = LOWEST_RIM_Y;
  for (let layer = 0; layer < TIER_COUNT; layer += 1) {
    tiers.push({
      radius: LOWEST_RADIUS - layer * RADIUS_STEP,
      height: LOWEST_HEIGHT - layer * HEIGHT_STEP,
      baseY,
      rotationY: layer * 0.34,
    });
    baseY += LOWEST_RISE - layer * RISE_STEP;
  }
  return tiers;
}

/** Foliage cones, lowest first. */
export const TREE_TIERS: readonly ConeTier[] = buildTiers();

export const TREE_TOP_Y = TREE_TIERS[TREE_TIERS.length - 1].baseY + TREE_TIERS[TREE_TIERS.length - 1].height;
export const TRUNK = { radiusTop: 0.34, radiusBottom: 0.5, height: 1.6, bottomY: LOWEST_RIM_Y - 1.05 } as const;
export const GROUND_Y = TRUNK.bottomY;
export const STAR_Y = TREE_TOP_Y + 0.18;

/** Radius of a cone's circumscribing circle at height `y` (0 outside the cone). */
export function coneRadiusAt(tier: ConeTier, y: number): number {
  if (y < tier.baseY || y > tier.baseY + tier.height) return 0;
  return (tier.radius * (tier.baseY + tier.height - y)) / tier.height;
}

/**
 * Distance from the axis to the polygonal rim of `tier` in direction `angle`
 * (atan2(x, z)). The rim is an N-gon whose vertices lie on `tier.radius`, so
 * between vertices the edge is slightly closer to the trunk.
 */
export function rimRadiusAt(tier: ConeTier, angle: number, segments = CONE_SEGMENTS): number {
  const step = (Math.PI * 2) / segments;
  const local = ((angle - tier.rotationY) % step + step) % step;
  return (tier.radius * Math.cos(step / 2)) / Math.cos(local - step / 2);
}
