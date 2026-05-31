// A quadtree node is one triangle strip whose indices are drawn as
// gl.UNSIGNED_SHORT, so every index *value* must fit in a Uint16 (<=65535).
// The largest index in an n-subdivision node is its last vertex,
// (n+1)^2 - 1, which stays <= 65535 up to n = 255. We cap a hair
// below that.
export const MAX_COMPONENT_SUBDIVISIONS = 250;

// Ceiling on the derived path-node count, as an A* cost guard.
export const MAX_PATH_NODES = 5000;

// Adjacent tiles are stitched (shared edges made to coincide) rather than masked
// by skirts. That is exact only when neighbors differ by at most one LOD level
// (a 2:1-balanced quadtree), which the boxDistance split rule guarantees as long
// as the split factor exceeds sqrt(2) ~= 1.414 -- so we floor the effective
// factor here.
export const LOD_MIN_SPLIT_FACTOR = 1.5;

// Uniform quadtree depth used when LOD is disabled
export const LOD_OFF_DEPTH = 4;

// Floor for the LRU cache; raised to fit the near field
export const MIN_NODE_CACHE = 512;

// -- Ground-material shader tuning (fed straight to the terrain shader) --
// Grass-noise frequency / how many times the dirt material tiles across the terrain.
export const TEX_REPEAT = 275;
// Depth of the parallax-occlusion relief, in tiled-UV units.
export const PARALLAX_SCALE = 0.015;
// Full parallax within this view distance (world units).
export const PARALLAX_NEAR = 5;
// Parallax fully faded out (and skipped) beyond this.
export const PARALLAX_FAR = 100;

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
export const TERRAIN_NEAR_SHADOW_SIZE = 4096;
export const TERRAIN_NEAR_SHADOW_RADIUS = 500; // half-extent of the near map, world units
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
