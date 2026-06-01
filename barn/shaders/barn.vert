// Barn timber shader: textured wood (with a door/window mask) lit by the
// abstract sun + moon and shadowed by the same maps as the terrain and wagon.
// Two normals are carried: the object-space one drives the door/window mask
// test (it keys off which face a vertex belongs to), the eye-space one drives
// the lighting; the eye-space position feeds the shadow-map lookups.
attribute vec3 aVertexPosition;
attribute vec3 aVertexNormal;
attribute vec2 aTextureCoord;

uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;
uniform mat4 uNMatrix;

varying vec2 vTextureCoord;
varying vec3 vObjNormal;  // object-space normal, for the door/window mask test
varying vec3 v_normal;    // eye-space normal, for the sun/moon lighting
varying vec3 v_view_pos;  // eye-space position, for the shadow-map lookups
varying vec3 vBarnPos;    // object-space position (barn height), for ground-contact AO

void main() {
    vTextureCoord = aTextureCoord;
    vObjNormal = aVertexNormal;
    vBarnPos = aVertexPosition;

    vec4 view_pos = uMVMatrix * vec4(aVertexPosition, 1.0);
    v_view_pos = view_pos.xyz;
    v_normal = normalize((uNMatrix * vec4(aVertexNormal, 0.0)).xyz);

    gl_Position = uPMatrix * view_pos;
}
