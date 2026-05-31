// Rock shader: textured stone that takes the sun's terrain shadows, the same way
// the hay bales and wagon body do. Eye-space position + normal and the texture UV
// are passed to the fragment stage; the shadow maps are sampled there with the
// exact same uniforms as the terrain and wagon shaders.
attribute vec3 aVertexPosition;
attribute vec3 aVertexNormal;
attribute vec2 aTextureCoord;

uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;
uniform mat4 uNMatrix;

varying vec2 v_uv;        // texture coordinate
varying vec3 v_normal;    // view-space normal
varying vec3 v_view_pos;  // view-space position, for the shadow lookup
varying float v_fog_depth; // distance in front of the camera, for distance fog

void main() {
    vec4 view_pos = uMVMatrix * vec4(aVertexPosition, 1.0);
    gl_Position = uPMatrix * view_pos;
    v_view_pos = view_pos.xyz;
    v_normal = normalize((uNMatrix * vec4(aVertexNormal, 0.0)).xyz);
    v_uv = aTextureCoord;
    v_fog_depth = -view_pos.z;
}
