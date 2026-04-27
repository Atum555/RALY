#ifdef GL_ES
precision highp float;
#endif

varying vec2 vTextureCoord;
varying float vTimeFactor;

uniform float cloudscale;
const float speed = 0.03;
uniform float clouddark;
uniform float cloudlight;
uniform float cloudcover;
uniform float cloudalpha;
uniform float skytint;
uniform vec3 skycolour1;
uniform vec3 skycolour2;

const mat2 m = mat2(1.6, 1.2, -1.2, 1.6);

vec2 hash(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float noise(in vec2 p) {
    const float skewFactor = 0.366025404; // (sqrt(3) - 1) / 2
    const float unSkewFactor = 0.211324865; // (3 - sqrt(3)) / 6
    vec2 i = floor(p + (p.x + p.y) * skewFactor); // Cell Origin in skewed space
    vec2 toCorner0 = p - i + (i.x + i.y) * unSkewFactor;
    vec2 o = (toCorner0.x > toCorner0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec2 toCorner1 = toCorner0 - o + unSkewFactor;
    vec2 toCorner2 = toCorner0 - 1.0 + 2.0 * unSkewFactor;
    vec3 fallOff = max(0.5 - vec3(dot(toCorner0,toCorner0), dot(toCorner1,toCorner1), dot(toCorner2,toCorner2)), 0.0);
    vec3 n = fallOff*fallOff*fallOff*fallOff * vec3(dot(toCorner0, hash(i)), dot(toCorner1, hash(i+o)), dot(toCorner2, hash(i+1.0)));
    return dot(n, vec3(70.0));
}

float fbm(vec2 n) {
    float total = 0.0, amplitude = 0.1;
    for (int i = 0; i < 7; i++) {
        total     += noise(n) * amplitude;
        n          = m * n;
        amplitude *= 0.4;
    }
    return total;
}

void main() {
    vec2 p  = vTextureCoord;
    vec2 uv = p * cloudscale;

    float time = vTimeFactor * speed;

    float q = fbm(uv * cloudscale * 0.5);

    float r = 0.0;
    vec2 uvr = uv * cloudscale - q + time;
    float weight = 0.8;
    for (int i = 0; i < 8; i++) {
        r      += abs(weight * noise(uvr));
        uvr     = m * uvr + time;
        weight *= 0.7;
    }

    float f = 0.0;
    vec2 uvf = uv * cloudscale - q + time;
    weight = 0.7;
    for (int i = 0; i < 8; i++) {
        f      += weight * noise(uvf);
        uvf     = m * uvf + time;
        weight *= 0.6;
    }

    f *= r + f;

    float c = 0.0;
    vec2 uvc = uv * cloudscale * 2.0 - q + vTimeFactor * speed * 2.0;
    weight = 0.4;
    for (int i = 0; i < 7; i++) {
        c      += weight * noise(uvc);
        uvc     = m * uvc + vTimeFactor * speed * 2.0;
        weight *= 0.6;
    }

    float c1 = 0.0;
    vec2 uvc1 = uv * cloudscale * 3.0 - q + vTimeFactor * speed * 3.0;
    weight = 0.4;
    for (int i = 0; i < 7; i++) {
        c1      += abs(weight * noise(uvc1));
        uvc1     = m * uvc1 + vTimeFactor * speed * 3.0;
        weight  *= 0.6;
    }

    c += c1;

    vec3 skycolour   = mix(skycolour2, skycolour1, p.y);
    vec3 cloudcolour = vec3(1.1, 1.1, 0.9) * clamp(clouddark + cloudlight * c, 0.0, 1.0);

    f = cloudcover + cloudalpha * f * r;

    vec3 result = mix(
        skycolour,
        clamp(skytint * skycolour + cloudcolour, 0.0, 1.0),
        clamp(f + c, 0.0, 1.0)
    );

    gl_FragColor = vec4(result, 1.0);
}