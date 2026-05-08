attribute vec3 aVertexPosition;
attribute vec3 aVertexNormal;
attribute vec2 aTextureCoord;

uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;
uniform mat4 uNMatrix;


varying vec2  vTextureCoord;
varying vec3 vPosition;
varying vec3 vNormal;

float hash(float n) { return fract(sin(n) * 1e4); }
float hash(vec2 p) { return fract(1e4 * sin(17.0 * p.x + p.y * 0.1) * (0.1 + abs(sin(p.y * 13.0 + p.x)))); }


float noise(vec3 p){
	const vec3 step = vec3(110, 241, 171);

	vec3 i = floor(p);
	vec3 f = fract(p);
 
    float n = dot(i, step);

	vec3 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(mix( hash(n + dot(step, vec3(0, 0, 0))), hash(n + dot(step, vec3(1, 0, 0))), u.x),
                   mix( hash(n + dot(step, vec3(0, 1, 0))), hash(n + dot(step, vec3(1, 1, 0))), u.x), u.y),
               mix(mix( hash(n + dot(step, vec3(0, 0, 1))), hash(n + dot(step, vec3(1, 0, 1))), u.x),
                   mix( hash(n + dot(step, vec3(0, 1, 1))), hash(n + dot(step, vec3(1, 1, 1))), u.x), u.y), u.z);
}

float fbm(vec3 p){
    float total = 0.0, amplitude = 0.1, persistance = 0.03;
    for (int i = 0; i < 5; i++) {
        total     += noise(p) * amplitude;
        amplitude *= persistance;
    }
    return total;
}


void main() {

    float uNoiseScale = 1.0;
    float uNoiseStrength = 1.7;

    float displacement = fbm(aVertexPosition * uNoiseScale);

    displacement = displacement - 0.5;

    vec3 displacedPosition = aVertexPosition + aVertexNormal * displacement * uNoiseStrength;

    gl_Position = uPMatrix * uMVMatrix * vec4(displacedPosition, 1.0);

    vNormal   = normalize(vec3(uNMatrix * vec4(aVertexNormal, 0.0)));
    vPosition = vec3(uMVMatrix * vec4(displacedPosition, 1.0));

}