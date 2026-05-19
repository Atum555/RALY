#ifdef GL_ES
precision highp float;
#endif

const float PI = 3.14159265358979;
const mat2 noise_rotation = mat2(1.6, 1.2, -1.2, 1.6);

varying vec3 v_direction;

uniform float drift;

uniform bool cloud_display;
uniform bool sun_moon_display;
uniform float cloud_scale;
uniform float cloud_dark;
uniform float cloud_light;
uniform float cloud_cover;
uniform float cloud_alpha;

uniform vec3 day_colour1;
uniform vec3 day_colour2;
uniform vec3 night_colour1;
uniform vec3 night_colour2;

uniform float sun_angle;
uniform float day_factor;

vec2 hash(vec2 point) {
    point = vec2(dot(point, vec2(127.1, 311.7)), dot(point, vec2(269.5, 183.3)));
    return -1.0 + 2.0 * fract(sin(point) * 43758.5453123);
}

float noise(in vec2 point) {
    const float skew_factor = 0.366025404; // (sqrt(3) - 1) / 2
    const float un_skew_factor = 0.211324865; // (3 - sqrt(3)) / 6
    vec2 cell_origin = floor(point + (point.x + point.y) * skew_factor);
    vec2 to_corner0 = point - cell_origin + (cell_origin.x + cell_origin.y) * un_skew_factor;
    vec2 corner_offset = (to_corner0.x > to_corner0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec2 to_corner1 = to_corner0 - corner_offset + un_skew_factor;
    vec2 to_corner2 = to_corner0 - 1.0 + 2.0 * un_skew_factor;
    vec3 fall_off = max(0.5 - vec3(dot(to_corner0, to_corner0), dot(to_corner1, to_corner1), dot(to_corner2, to_corner2)), 0.0);
    vec3 contributions = fall_off * fall_off * fall_off * fall_off * vec3(dot(to_corner0, hash(cell_origin)), dot(to_corner1, hash(cell_origin + corner_offset)), dot(to_corner2, hash(cell_origin + 1.0)));
    return dot(contributions, vec3(70.0));
}

float fbm(vec2 point) {
    float total = 0.0;
    float amplitude = 0.1;
    for(int i = 0; i < 7; i++) {
        total += noise(point) * amplitude;
        point = noise_rotation * point;
        amplitude *= 0.4;
    }
    return total;
}

struct CloudResult {
    vec3 colour;
    float coverage;
};

CloudResult clouds(vec3 sky_colour) {
    // Project view direction onto a flat cloud plane above the observer.
    // The 1/y term shrinks features toward the horizon, simulating
    // distance from the dome centre.
    vec2 plane_uv = v_direction.xz / v_direction.y;

    // 1 at horizon, 0 well above it — atmospheric haze that tints
    // distant clouds toward the sky colour so the blue wins through.
    float haze = 1.0 - smoothstep(0.02, 0.25, v_direction.y);

    vec2 uv = plane_uv * cloud_scale * 5.0;

    float domain_warp = fbm(uv * cloud_scale * 0.5);

    float cloud_turbulence = 0.0;
    vec2 turbulence_uv = uv * cloud_scale - domain_warp + drift;
    float weight = 0.8;
    for(int i = 0; i < 8; i++) {
        cloud_turbulence += abs(weight * noise(turbulence_uv));
        turbulence_uv = noise_rotation * turbulence_uv + drift;
        weight *= 0.7;
    }

    float cloud_density = 0.0;
    vec2 density_uv = uv * cloud_scale - domain_warp + drift;
    weight = 0.7;
    for(int i = 0; i < 8; i++) {
        cloud_density += weight * noise(density_uv);
        density_uv = noise_rotation * density_uv + drift;
        weight *= 0.6;
    }

    cloud_density *= cloud_turbulence + cloud_density;

    float cloud_highlight = 0.0;
    vec2 highlight_uv = uv * cloud_scale * 2.0 - domain_warp + drift * 2.0;
    weight = 0.4;
    for(int i = 0; i < 7; i++) {
        cloud_highlight += weight * noise(highlight_uv);
        highlight_uv = noise_rotation * highlight_uv + drift * 2.0;
        weight *= 0.6;
    }

    float highlight_detail = 0.0;
    vec2 detail_uv = uv * cloud_scale * 3.0 - domain_warp + drift * 3.0;
    weight = 0.4;
    for(int i = 0; i < 7; i++) {
        highlight_detail += abs(weight * noise(detail_uv));
        detail_uv = noise_rotation * detail_uv + drift * 3.0;
        weight *= 0.6;
    }

    cloud_highlight += highlight_detail;

    vec3 cloud_colour = vec3(1.1, 1.1, 0.9) * clamp(cloud_dark + cloud_light * cloud_highlight, 0.0, 1.0);
    cloud_density = cloud_cover + cloud_alpha * cloud_density * cloud_turbulence;

    float cloud_amount = cloud_density + cloud_highlight;

    vec3 lit_cloud = clamp((0.2 + 0.3 * day_factor) * sky_colour + cloud_colour, 0.0, 1.0);
    vec3 hazed_cloud = mix(lit_cloud, sky_colour, haze);

    return CloudResult(mix(sky_colour, hazed_cloud, clamp(cloud_amount, 0.0, 1.0)), clamp(cloud_amount, 0.0, 0.6) * (1.0 - haze));
}

vec4 sun(float coverage) {
    float cycle_angle = mod(sun_angle, 4.0 * PI);
    if(cycle_angle >= 2.0 * PI)
        return vec4(0.0);

    vec3 sun_dir = vec3(cos(cycle_angle), sin(cycle_angle), 0.0);
    float alignment = dot(v_direction, sun_dir);
    float disc = smoothstep(0.99, 1.0, alignment);
    float glow = smoothstep(0.96, 0.99, alignment);
    return vec4(vec3(0.996, 0.877, 0.535), (disc + glow * 0.3) * (1.0 - coverage));
}

vec4 moon(float coverage) {
    float cycle_angle = mod(sun_angle, 4.0 * PI);
    if(cycle_angle < 2.0 * PI)
        return vec4(0.0);

    float moon_phase_angle = cycle_angle - 2.0 * PI;
    vec3 moon_dir = vec3(cos(moon_phase_angle), sin(moon_phase_angle), 0.0);
    float alignment = dot(v_direction, moon_dir);
    float disc = smoothstep(0.995, 1.0, alignment);
    return vec4(vec3(0.9, 0.92, 1.0), disc * (1.0 - coverage));
}

void main() {
    float elevation = clamp(v_direction.y, 0.0, 1.0);
    vec3 sky_colour = mix(mix(night_colour2, night_colour1, elevation), mix(day_colour2, day_colour1, elevation), day_factor);

    CloudResult cloud_layer = CloudResult(sky_colour, 0.0);
    if (cloud_display) cloud_layer = clouds(sky_colour);
    vec3 result = cloud_layer.colour;

    if (sun_moon_display) {
        vec4 sun_layer = sun(cloud_layer.coverage);
        result = mix(result, sun_layer.rgb, sun_layer.a);

        vec4 moon_layer = moon(cloud_layer.coverage);
        result = mix(result, moon_layer.rgb, moon_layer.a);
    }

    gl_FragColor = vec4(result, 1.0);
}
