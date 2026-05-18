#ifdef GL_ES
precision highp float;
#endif

varying vec2 v_texture_coord;
varying float v_time_factor;

uniform float cloud_scale;
uniform float radius;
const float speed = 0.03;
uniform float cloud_dark;
uniform float cloud_light;
uniform float cloud_cover;
uniform float cloud_alpha;
uniform float sky_tint;
uniform vec3 sky_colour1;
uniform vec3 sky_colour2;
uniform vec3 night_colour1;
uniform vec3 night_colour2;

uniform float sun_angle;
uniform float day_factor;
const float PI = 3.14159265358979;

const mat2 m = mat2(1.6, 1.2, -1.2, 1.6);

vec2 hash(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float noise(in vec2 p) {
    const float skew_factor = 0.366025404; // (sqrt(3) - 1) / 2
    const float un_skew_factor = 0.211324865; // (3 - sqrt(3)) / 6
    vec2 i = floor(p + (p.x + p.y) * skew_factor); // Cell Origin in skewed space
    vec2 to_corner0 = p - i + (i.x + i.y) * un_skew_factor;
    vec2 o = (to_corner0.x > to_corner0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec2 to_corner1 = to_corner0 - o + un_skew_factor;
    vec2 to_corner2 = to_corner0 - 1.0 + 2.0 * un_skew_factor;
    vec3 fall_off = max(0.5 - vec3(dot(to_corner0, to_corner0), dot(to_corner1, to_corner1), dot(to_corner2, to_corner2)), 0.0);
    vec3 n = fall_off * fall_off * fall_off * fall_off * vec3(dot(to_corner0, hash(i)), dot(to_corner1, hash(i + o)), dot(to_corner2, hash(i + 1.0)));
    return dot(n, vec3(70.0));
}

float fbm(vec2 n) {
    float total = 0.0, amplitude = 0.1;
    for(int i = 0; i < 7; i++) {
        total += noise(n) * amplitude;
        n = m * n;
        amplitude *= 0.4;
    }
    return total;
}

void main() {
    vec2 p = v_texture_coord;
    vec2 uv = p * cloud_scale * 0.8 * (radius / 50.0);

    float time = v_time_factor * speed;

    float q = fbm(uv * cloud_scale * 0.5);

    float r = 0.0;
    vec2 uvr = uv * cloud_scale - q + time;
    float weight = 0.8;
    for(int i = 0; i < 8; i++) {
        r += abs(weight * noise(uvr));
        uvr = m * uvr + time;
        weight *= 0.7;
    }

    float f = 0.0;
    vec2 uvf = uv * cloud_scale - q + time;
    weight = 0.7;
    for(int i = 0; i < 8; i++) {
        f += weight * noise(uvf);
        uvf = m * uvf + time;
        weight *= 0.6;
    }

    f *= r + f;

    float c = 0.0;
    vec2 uvc = uv * cloud_scale * 2.0 - q + v_time_factor * speed * 2.0;
    weight = 0.4;
    for(int i = 0; i < 7; i++) {
        c += weight * noise(uvc);
        uvc = m * uvc + v_time_factor * speed * 2.0;
        weight *= 0.6;
    }

    float c1 = 0.0;
    vec2 uvc1 = uv * cloud_scale * 3.0 - q + v_time_factor * speed * 3.0;
    weight = 0.4;
    for(int i = 0; i < 7; i++) {
        c1 += abs(weight * noise(uvc1));
        uvc1 = m * uvc1 + v_time_factor * speed * 3.0;
        weight *= 0.6;
    }

    c += c1;

    float elevation = clamp((p.y - 0.5) * 2.0, 0.0, 1.0);
    vec3 current_colour1 = mix(sky_colour2, sky_colour1, elevation);
    vec3 current_colour2 = mix(night_colour2, night_colour1, elevation);
    vec3 sky_colour = mix(current_colour2, current_colour1, day_factor);

    vec3 cloud_colour = vec3(1.1, 1.1, 0.9) * clamp(cloud_dark + cloud_light * c, 0.0, 1.0);

    f = cloud_cover + cloud_alpha * f * r;

    vec3 result = mix(sky_colour, clamp(sky_tint * sky_colour + cloud_colour, 0.0, 1.0), clamp(f + c, 0.0, 1.0));

    // Sun and Moon
    float angle = mod(sun_angle, 4.0 * PI);
    float position = angle / PI;

    float coverage = clamp(f + c, 0.0, 0.6);

    if(angle > 0.0 && angle < 2.0 * PI) {
        vec2 sun_coord = vec2(position, 0.45);

        vec2 delta = p - sun_coord;
        delta.x /= 4.0;
        float d = length(delta);
        float disc = 1.0 - smoothstep(0.0, 0.03, d);
        float glow = 1.0 - smoothstep(0.03, 0.05, d);
        result = mix(result, vec3(0.996, 0.877, 0.535), (disc + glow * 0.3) * (1.0 - coverage));
    } else if(angle > 2.0 * PI && angle < 4.0 * PI) {
        vec2 moon_coord = vec2(position - 2.0, 0.45);

        vec2 delta = p - moon_coord;
        delta.x /= 4.0;
        float d = length(delta);
        float disc = 1.0 - smoothstep(0.0, 0.022, d);
        result = mix(result, vec3(0.9, 0.92, 1.0), disc * (1.0 - coverage));
    }

    gl_FragColor = vec4(result, 1.0);
}
