// Flower-field shader: untextured petals/stems/leaves lit by the abstract sun and
// shadowed by the same depth maps as the terrain and wagon. Only the eye-space
// position and normal are needed downstream; the flower's flat colour is a uniform
// (the baked field has no texture coordinates), and the shadow maps are sampled in
// the fragment stage with the exact same uniforms as the terrain/wagon shaders.
attribute vec3 aVertexPosition;
attribute vec3 aVertexNormal;

uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;
uniform mat4 uNMatrix;

varying vec3 v_normal;   // view-space normal
varying vec3 v_view_pos; // view-space position, for the shadow lookup

void main() {
    vec4 view_pos = uMVMatrix * vec4(aVertexPosition, 1.0);
    gl_Position = uPMatrix * view_pos;
    v_view_pos = view_pos.xyz;
    v_normal = normalize((uNMatrix * vec4(aVertexNormal, 0.0)).xyz);
}
