// Grass-field shader: short blades scattered over the terrain's grass, bent by
// wind and shadowed by the same depth maps as the terrain, wagon and flowers.
//
// The field is drawn as merged per-cell meshes (one draw per scatter cell, see
// GrassCellMesh), so the geometry arrives already in WORLD space with no per-tuft
// model matrix or per-tuft uniforms. The position attribute is split so the wind
// bend still works:
//
//   aVertexPosition.xz = the blade's WORLD position (tuft offset, yaw and scale
//                        already baked in)
//   aVertexPosition.y  = the blade's LOCAL height above its own root (scaled) --
//                        drives the wind amplitude and the root shading
//   aBase              = the tuft's terrain ground height, added back below so the
//                        blade sits on the ground
//
// Because the geometry is already world-space, the field-wide wind wave reads its
// phase straight from each blade's world XZ and bends every blade toward the same
// world direction (uWindDir) -- no per-tuft yaw correction needed. The bent world
// position is then taken into eye space so the fragment-stage shadow lookup (same
// uniforms as the other surface shaders) tracks the blade as it sways.
attribute vec3 aVertexPosition;
attribute vec3 aVertexNormal;
attribute float aBase;

uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;
uniform mat4 uNMatrix;

uniform float uTime;
uniform float uWindEnabled;
uniform float uWindStrength;
uniform float uWindSpeed;
uniform float uWindSpatialFreq;
uniform vec2  uWindDir;    // world-space wind direction (normalized), set once

varying vec3 v_normal;   // view-space normal
varying vec3 v_view_pos; // view-space position, for the shadow lookup
varying float v_local_y; // local blade height (0 at the root), for root shading

void main() {
    vec2 worldXZ = aVertexPosition.xz;
    float localY = aVertexPosition.y; // height above this blade's root (scaled)

    // Field-wide wind: the phase advances along uWindDir across the WORLD, so one
    // gust rolls over every tuft as a single travelling wave (uWindSpatialFreq sets
    // the wavelength). A small per-blade flutter keeps the tips from looking rigid.
    // Taller parts of the blade (larger localY) bend more, so the tips wave while
    // the roots stay planted. Disabled (uWindEnabled = 0) leaves the blade upright.
    float worldPhase = dot(worldXZ, uWindDir) * uWindSpatialFreq - uTime * uWindSpeed;
    float gust = (1.0 - cos(worldPhase)) * 0.5;                               // 0..1 wave
    float flutter = sin(uTime * uWindSpeed * 1.7 + (worldXZ.x + worldXZ.y) * 7.0) * 0.12;
    float sway = (gust + flutter) * uWindStrength * localY * uWindEnabled;

    // Reassemble the world position: world XZ as baked, local height seated on the
    // tuft's ground height, bent toward the world wind direction.
    vec3 world_pos = vec3(worldXZ.x, localY + aBase, worldXZ.y);
    world_pos.x += uWindDir.x * sway;
    world_pos.z += uWindDir.y * sway;

    vec4 view_pos = uMVMatrix * vec4(world_pos, 1.0);
    gl_Position = uPMatrix * view_pos;
    v_view_pos = view_pos.xyz;

    // A blade is a near-vertical triangle, so its geometric normal is almost
    // horizontal, and the per-tuft yaw baked into the mesh sends it off in a
    // random world direction. Under the directional sun that lit each tuft by the
    // luck of which way it happened to face -- some blazing, some near-black. Round
    // the lighting normal strongly toward world up so every blade is lit alike by
    // the sun overhead; the root-to-tip gradient (v_local_y) still shapes the tuft.
    vec3 rounded_normal = normalize(mix(normalize(aVertexNormal), vec3(0.0, 1.0, 0.0), 0.7));
    v_normal = normalize((uNMatrix * vec4(rounded_normal, 0.0)).xyz);
    v_local_y = localY;
}
