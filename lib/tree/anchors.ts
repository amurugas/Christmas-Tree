import {
  coneRadiusAt,
  rimRadiusAt,
  STANDARD_ORNAMENT_SPAN,
  TREE_TIERS,
  type ConeTier,
} from "./geometry.ts";

export type Vec3 = readonly [number, number, number];

export type TreeAnchor = {
  slot: number;
  /** Branch tip: the point on the cone's lower rim the hook hangs from. */
  tip: Vec3;
  /** Where the ornament's eyelet (its glTF origin) goes; directly below and just outside `tip`. */
  position: Vec3;
  /** Rotation around Y that turns the ornament's +Z face outward. */
  rotationY: number;
  /** Index into TREE_TIERS of the cone this anchor hangs from. */
  tier: number;
};

export const TREE_SLOT_COUNT = 60;
/** Ornaments per ring, top ring first (slot 1 is on the top ring). */
export const ORNAMENTS_PER_RIDGE = [4, 6, 8, 9, 10, 11, 12] as const;
/** Vertical drop of the hook from the branch tip to the eyelet. */
export const HOOK_DROP = 0.1;
/** Smallest outward step from the branch tip to the eyelet. */
export const MIN_HOOK_REACH = 0.03;
/** Clearance kept between a 4" ornament and any foliage. */
export const FOLIAGE_CLEARANCE = 0.03;

/**
 * How far past the rim (radially) an eyelet must sit so a standard 4"
 * ornament hanging from `tier`'s rim, centred below its eyelet, clears every
 * other cone.
 */
export function requiredReach(tierIndex: number, rimRadius: number, tiers: readonly ConeTier[] = TREE_TIERS): number {
  const tier = tiers[tierIndex];
  const top = tier.baseY - HOOK_DROP;
  const bottom = top - STANDARD_ORNAMENT_SPAN - FOLIAGE_CLEARANCE;
  let reach = MIN_HOOK_REACH;
  tiers.forEach((other, index) => {
    if (index === tierIndex) return;
    const low = Math.max(bottom, other.baseY);
    const high = Math.min(top, other.baseY + other.height);
    if (low > high) return;
    // Cones widen downward, so the widest cross-section is at `low`.
    const needed = coneRadiusAt(other, low) + STANDARD_ORNAMENT_SPAN / 2 + FOLIAGE_CLEARANCE - rimRadius;
    reach = Math.max(reach, needed);
  });
  return reach;
}

export function createTreeAnchors(count = TREE_SLOT_COUNT, tiers: readonly ConeTier[] = TREE_TIERS): TreeAnchor[] {
  const anchors: TreeAnchor[] = [];

  // Keep the original seven ornament rings and slot positions stable;
  // additional crown tiers add height above them without moving uploads.
  for (let ridge = 0; ridge < ORNAMENTS_PER_RIDGE.length && anchors.length < count; ridge += 1) {
    const tierIndex = Math.min(tiers.length, ORNAMENTS_PER_RIDGE.length) - 1 - ridge;
    const tier = tiers[tierIndex];
    const capacity = ORNAMENTS_PER_RIDGE[ridge];
    const stagger = ridge % 2 === 0 ? 0 : Math.PI / capacity;

    for (let index = 0; index < capacity && anchors.length < count; index += 1) {
      const angle = (index / capacity) * Math.PI * 2 + stagger;
      const rim = rimRadiusAt(tier, angle);
      const reach = requiredReach(tierIndex, rim, tiers);
      const sin = Math.sin(angle);
      const cos = Math.cos(angle);
      anchors.push({
        slot: anchors.length + 1,
        tip: [sin * rim, tier.baseY, cos * rim],
        position: [sin * (rim + reach), tier.baseY - HOOK_DROP, cos * (rim + reach)],
        rotationY: angle,
        tier: tierIndex,
      });
    }
  }

  return anchors;
}

export const TREE_ANCHORS = createTreeAnchors();
