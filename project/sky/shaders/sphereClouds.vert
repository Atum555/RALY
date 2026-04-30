attribute vec3 aVertexPosition;
attribute vec3 aVertexNormal;

uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;
uniform mat4 uNMatrix;
uniform float timeFactor;
const float radius = 20.0;

varying vec2  vTextureCoord;
varying float vTimeFactor;

const float PI = 3.14159265358979;

void main() {
    gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);

    float azimuth   = atan(aVertexPosition.x, aVertexPosition.z);
    float elevation = asin(aVertexPosition.y / radius);

    vTextureCoord = vec2(
        azimuth   / (2.0 * PI) + 0.5,
        elevation / (PI * 0.5)    // 0 at horizon, 1 at zenith
    );

    vTimeFactor = timeFactor;
}