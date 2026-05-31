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

// -- Sun shadows (two dedicated maps) --
// The terrain and the sun are both static, so the terrain's shadow map is baked
// ONCE over the whole terrain at high resolution and never re-rendered. The
// wagon, which moves, gets its own small but very-high-resolution map that
// follows it, so its shadow stays crisp instead of inheriting the terrain map's
// coarse texels. A fragment is shadowed if EITHER map occludes the sun.
//
// The bias bands are the slope-scaled depth offset (normalized light-clip depth)
// that fights shadow acne without detaching shadows from their casters; the
// terrain map's larger texels need more bias than the wagon's tiny ones.
// Whole-area terrain map: baked once over the entire terrain (coarse, for the
// distant shadows the near map below doesn't reach).
export const TERRAIN_SHADOW_SIZE = 4096; // baked once; covers the whole terrain
export const TERRAIN_SHADOW_LOD_DEPTH = 4; // uniform quadtree depth for the bake (higher = finer + slower bake)
export const TERRAIN_SHADOW_BIAS_MIN = 0.0015;
export const TERRAIN_SHADOW_BIAS_MAX = 0.006;

// Near terrain map: same resolution but over a small square that follows the
// wagon, so terrain self-shadows are sharp around it. It re-renders (re-centres
// on the wagon) only once the wagon drifts more than TERRAIN_NEAR_SHADOW_RECENTER
// from the map's centre. Drawn at the wagon-centred LOD, so it reuses the main
// pass's fine tiles. Where a fragment is inside this map it overrides the
// whole-area map.
export const TERRAIN_NEAR_SHADOW_SIZE = 4096;
export const TERRAIN_NEAR_SHADOW_RADIUS = 650; // half-extent of the near map, world units
export const TERRAIN_NEAR_SHADOW_RECENTER = 200; // re-centre once the wagon drifts this far, world units
export const TERRAIN_NEAR_SHADOW_BIAS_MIN = 0.0008;
export const TERRAIN_NEAR_SHADOW_BIAS_MAX = 0.004;

export const WAGON_SHADOW_SIZE = 4096; // small + crisp; follows the wagon
export const WAGON_SHADOW_RADIUS = 50; // half-extent of the wagon map, world units
export const WAGON_SHADOW_BIAS_MIN = 0.0008;
export const WAGON_SHADOW_BIAS_MAX = 0.003;
