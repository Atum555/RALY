// Flower-field shader: untextured petals/stems/leaves lit by the abstract sun and
// shadowed by the same depth maps as the terrain and wagon. Only the eye-space
// position and normal are needed downstream; the flower's flat colour rides in as
// a per-vertex attribute (the baked field has no texture coordinates, and a
// per-draw colour uniform was the frame's hot spot), and the shadow maps are
// sampled in the fragment stage with the exact same uniforms as the terrain/wagon.
attribute vec3 aVertexPosition;
attribute vec3 aVertexNormal;
attribute vec3 aVertexColor; // baked flat colour of this primitive's material group

uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;
uniform mat4 uNMatrix;

varying vec3 v_normal;   // view-space normal
varying vec3 v_view_pos; // view-space position, for the shadow lookup
varying vec3 v_color;    // flat petal/stem/leaf colour

void main() {
    vec4 view_pos = uMVMatrix * vec4(aVertexPosition, 1.0);
    gl_Position = uPMatrix * view_pos;
    v_view_pos = view_pos.xyz;
    v_normal = normalize((uNMatrix * vec4(aVertexNormal, 0.0)).xyz);
    v_color = aVertexColor;
}
