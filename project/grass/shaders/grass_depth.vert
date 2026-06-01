// Depth-only grass vertex shader for the shadow pass. It mirrors the lit grass
// shader (grass.vert): the geometry arrives merged in WORLD space with the blade
// split across aVertexPosition.xz (world XZ) and aVertexPosition.y (local blade
// height), plus aBase (the tuft's ground height). The SAME wind bend as the lit
// shader is reproduced here so the blade writes the bent silhouette it actually
// shows into the shadow map. Like the shared depth shader (terrain/shaders/
// depth.vert) it only emits gl_Position -- the hardware captures gl_FragCoord.z
// into the map's depth attachment, so the surface shaders read grass and terrain
// back in the same depth space.
attribute vec3 aVertexPosition;
attribute float aBase;

uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;

uniform float uTime;
uniform float uWindEnabled;
uniform float uWindStrength;
uniform float uWindSpeed;
uniform float uWindSpatialFreq;
uniform vec2  uWindDir;    // world-space wind direction (normalized)

void main() {
    vec2 worldXZ = aVertexPosition.xz;
    float localY = aVertexPosition.y; // height above this blade's root (scaled)

    // Field-wide wind, identical to grass.vert so the shadow sways with the blade.
    float worldPhase = dot(worldXZ, uWindDir) * uWindSpatialFreq - uTime * uWindSpeed;
    float gust = (1.0 - cos(worldPhase)) * 0.5;                               // 0..1 wave
    float flutter = sin(uTime * uWindSpeed * 1.7 + (worldXZ.x + worldXZ.y) * 7.0) * 0.12;
    float sway = (gust + flutter) * uWindStrength * localY * uWindEnabled;

    // Reassemble the world position: world XZ as baked, local height seated on the
    // tuft's ground height, bent toward the world wind direction.
    vec3 world_pos = vec3(worldXZ.x, localY + aBase, worldXZ.y);
    world_pos.x += uWindDir.x * sway;
    world_pos.z += uWindDir.y * sway;

    gl_Position = uPMatrix * uMVMatrix * vec4(world_pos, 1.0);
}
