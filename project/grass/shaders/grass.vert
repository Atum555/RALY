attribute vec3 aVertexPosition;
attribute vec3 aVertexNormal;
attribute vec2 aTextureCoord;

uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;
uniform mat4 uNMatrix;

uniform float uTime;
uniform float uWindEnabled;
uniform float uWindStrength;
uniform float uWindSpeed;
uniform float uWindSpatialFreq;

void main() {
    vec3 pos = aVertexPosition;
    float phase = pos.z * uWindSpatialFreq - uTime * uWindSpeed;
    float bendFactor = (1.0 - cos(phase)) * 0.7 - 0.4;
    float bend = bendFactor * uWindStrength * pos.y * uWindEnabled;
    pos.z += bend;
    gl_Position = uPMatrix * uMVMatrix * vec4(pos, 1.0);
}
