attribute vec3 aVertexPosition;
attribute vec3 aVertexNormal;
attribute vec3 a_vertex_tangent; // surface tangent along +U of a_terrain_uv
attribute vec2 a_terrain_uv;     // vertex position normalized 0..1 across the whole terrain
attribute float a_path_dist;     // normalized distance to nearest path: 0 = centre, 1 = transition end

uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;
uniform mat4 uNMatrix;

varying vec2 v_terrain_uv;
varying vec3 v_normal;    // view-space geometric normal
varying vec3 v_tangent;   // view-space tangent
varying vec3 v_view_pos;  // view-space position, for parallax and the specular view direction
varying float v_fog_depth; // distance in front of the camera, for distance fog
varying float v_path_dist;

void main() {
    vec4 view_pos = uMVMatrix * vec4(aVertexPosition, 1.0);
    gl_Position = uPMatrix * view_pos;

    v_terrain_uv = a_terrain_uv;
    v_path_dist = a_path_dist;
    v_normal = normalize((uNMatrix * vec4(aVertexNormal, 0.0)).xyz);
    v_tangent = normalize((uMVMatrix * vec4(a_vertex_tangent, 0.0)).xyz);
    v_view_pos = view_pos.xyz;
    v_fog_depth = -view_pos.z;
}
