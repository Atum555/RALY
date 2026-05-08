#ifdef GL_ES
precision highp float;
#endif

varying vec3 vNormal;
varying vec3 vPosition;

uniform vec3 uLightPos;
uniform vec3 uLightColor;
uniform vec3 uRockColor;

void main() {
    vec3 normal = normalize(vNormal);
    gl_FragColor = vec4(normal * 0.5 + 0.5, 1.0);
}