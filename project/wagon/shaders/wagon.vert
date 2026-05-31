// Wagon body shader: a soft solid colour that takes the sun's terrain and self
// shadows. Eye-space position + normal are passed to the fragment stage; the
// shadow maps are sampled there exactly like the terrain (same uniforms).
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
