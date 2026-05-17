attribute vec3 aVertexPosition;
attribute vec3 aVertexNormal;

uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;
uniform mat4 uNMatrix;
uniform float timeFactor;

varying vec2  vTextureCoord;
varying float vTimeFactor;

void main() {
    gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);

    vTextureCoord = vec2(
        aVertexPosition.x + 0.5,
        0.5 - aVertexPosition.y
    );

    vTimeFactor = timeFactor;
}