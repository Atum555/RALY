// Engine shader: the raly-mode engine block, lit by the abstract sun and taking
// the sun's terrain and self shadows the same way the wagon body and horses do.
// Eye-space position + normal are passed to the fragment stage; the shadow maps
// are sampled there with the exact same uniforms as the wagon/horse shaders. The
// model carries no texture coordinates, so the metallic look is procedural — no
// UV is forwarded.
attribute vec3 aVertexPosition;
attribute vec3 aVertexNormal;

uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;
uniform mat4 uNMatrix;

varying vec3 v_normal;     // view-space normal
varying vec3 v_view_pos;   // view-space position, for the shadow lookup and specular
varying float v_fog_depth; // distance in front of the camera, for distance fog

void main() {
    vec4 view_pos = uMVMatrix * vec4(aVertexPosition, 1.0);
    gl_Position = uPMatrix * view_pos;
    v_view_pos = view_pos.xyz;
    v_normal = normalize((uNMatrix * vec4(aVertexNormal, 0.0)).xyz);
    v_fog_depth = -view_pos.z;
}
