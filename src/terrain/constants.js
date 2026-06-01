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

// -- Barn contact AO (soft sky-occlusion the barn casts onto the ground) --
// How far the darkening reaches past the barn's footprint (world units), and how
// deep it gets right at the walls (fraction the sky-ambient fill is cut by).
export const BARN_AO_RADIUS = 45;
export const BARN_AO_STRENGTH = 0.7;
