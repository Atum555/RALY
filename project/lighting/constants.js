// -- Sun shadows (three dedicated maps) --
// The sun follows the day/night cycle, so all three maps are re-rendered every
// frame. A whole-terrain map covers the distant shadows; a near map follows the
// wagon for sharp self-shadows around it; and a small, very-high-resolution map
// holds the wagon's own silhouette so its cast shadow stays crisp. A fragment is
// shadowed if any of the maps occludes the sun.
//
// The bias bands are the slope-scaled depth offset (normalized light-clip depth)
// that fights shadow acne without detaching shadows from their casters; the
// terrain map's larger texels need more bias than the wagon's tiny ones.
// Whole-area terrain map: covers the entire terrain (coarse, for the distant
// shadows the near map below doesn't reach).
export const TERRAIN_SHADOW_SIZE = 4096; // covers the whole terrain
export const TERRAIN_SHADOW_LOD_DEPTH = 4; // uniform quadtree depth for the bake (higher = finer + slower bake)
export const TERRAIN_SHADOW_BIAS_MIN = 0.0015;
export const TERRAIN_SHADOW_BIAS_MAX = 0.006;

// Near terrain map: same resolution but over a small square that follows the
// wagon, so terrain self-shadows are sharp around it. Re-rendered every frame,
// centred on the wagon, at the wagon-centred LOD so it reuses the main pass's
// fine tiles. Where a fragment is inside this map it overrides the whole-area map.
export const TERRAIN_NEAR_SHADOW_SIZE = 8192;
export const TERRAIN_NEAR_SHADOW_RADIUS = 400; // half-extent of the near map, world units
export const TERRAIN_NEAR_SHADOW_BIAS_MIN = 0.0008;
export const TERRAIN_NEAR_SHADOW_BIAS_MAX = 0.004;
// The near frustum sits up-sun of the wagon far enough to contain distant
// casters whose long, low-sun shadows still reach the footprint. That reach
// grows like 1/sin(sun elevation); it is floored here (so it can't diverge as
// the sun crosses the horizon) and capped at the terrain size + headroom below
// (nothing on the terrain casts from farther). The depth bias is held at its
// radius-tuned world size as the reach stretches.
export const TERRAIN_NEAR_SHADOW_SUN_FLOOR = 0.05;
export const TERRAIN_NEAR_SHADOW_BACK_HEADROOM = 256; // world units beyond the terrain size

export const WAGON_SHADOW_SIZE = 4096; // small + crisp; follows the wagon
export const WAGON_SHADOW_RADIUS = 50; // half-extent of the wagon map, world units
export const WAGON_SHADOW_BIAS_MIN = 0.0008;
export const WAGON_SHADOW_BIAS_MAX = 0.003;
