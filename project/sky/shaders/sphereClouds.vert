attribute vec3 aVertexPosition;
attribute vec3 aVertexNormal;
attribute vec2 aTextureCoord;

uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;
uniform mat4 uNMatrix;
uniform float time_factor;
uniform float radius;

varying vec2 v_texture_coord;
varying float v_time_factor;

const float PI = 3.14159265358979;

void main() {
    gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);

    float azimuth = atan(aVertexPosition.x, aVertexPosition.z);
    float elevation = asin(aVertexPosition.y / radius);

    v_texture_coord = vec2(elevation / (PI / 2.0) + 1.0, azimuth / (2.0 * PI) + 0.5);

    v_time_factor = time_factor;
}
