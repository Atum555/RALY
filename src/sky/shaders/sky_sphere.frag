#ifdef GL_ES
precision highp float;
#endif

const mat2 noise_rotation = mat2(1.6, 1.2, -1.2, 1.6);

varying vec3 v_direction;

uniform float cloud_drift;

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

uniform float day_factor;

// World-space directions towards the sun and moon, the exact vectors the scene's
// directional lights and shadow maps use. Driving the discs from these keeps the
// painted sun/moon locked to where the light actually comes from.
uniform vec3 sun_world_dir;
uniform vec3 moon_world_dir;

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
    vec2 turbulence_uv = uv * cloud_scale - domain_warp + cloud_drift;
    float weight = 0.8;
    for(int i = 0; i < 8; i++) {
        cloud_turbulence += abs(weight * noise(turbulence_uv));
        turbulence_uv = noise_rotation * turbulence_uv + cloud_drift;
        weight *= 0.7;
    }

    float cloud_density = 0.0;
    vec2 density_uv = uv * cloud_scale - domain_warp + cloud_drift;
    weight = 0.7;
    for(int i = 0; i < 8; i++) {
        cloud_density += weight * noise(density_uv);
        density_uv = noise_rotation * density_uv + cloud_drift;
        weight *= 0.6;
    }

    cloud_density *= cloud_turbulence + cloud_density;

    float cloud_highlight = 0.0;
    vec2 highlight_uv = uv * cloud_scale * 2.0 - domain_warp + cloud_drift * 2.0;
    weight = 0.4;
    for(int i = 0; i < 7; i++) {
        cloud_highlight += weight * noise(highlight_uv);
        highlight_uv = noise_rotation * highlight_uv + cloud_drift * 2.0;
        weight *= 0.6;
    }

    float highlight_detail = 0.0;
    vec2 detail_uv = uv * cloud_scale * 3.0 - domain_warp + cloud_drift * 3.0;
    weight = 0.4;
    for(int i = 0; i < 7; i++) {
        highlight_detail += abs(weight * noise(detail_uv));
        detail_uv = noise_rotation * detail_uv + cloud_drift * 3.0;
        weight *= 0.6;
    }

    cloud_highlight += highlight_detail;

    // Clouds track the day/night cycle: a bright warm tint by day, fading to a
    // dark, slightly cool tone at night (day_factor is 0 at night, 1 by day), so
    // the cloud masses darken with the sky instead of staying lit through the night.
    vec3 cloud_tint = mix(vec3(0.18, 0.20, 0.28), vec3(1.1, 1.1, 0.9), day_factor);
    vec3 cloud_colour = cloud_tint * clamp(cloud_dark + cloud_light * cloud_highlight, 0.0, 1.0);
    cloud_density = cloud_cover + cloud_alpha * cloud_density * cloud_turbulence;

    float cloud_amount = cloud_density + cloud_highlight;

    vec3 lit_cloud = clamp((0.2 + 0.3 * day_factor) * sky_colour + cloud_colour, 0.0, 1.0);
    vec3 hazed_cloud = mix(lit_cloud, sky_colour, haze);

    return CloudResult(mix(sky_colour, hazed_cloud, clamp(cloud_amount, 0.0, 1.0)), clamp(cloud_amount, 0.0, 0.6) * (1.0 - haze));
}

// A glowing solar disc: a near-white core with a warm rim, a two-scale corona
// that blooms into the surrounding sky, and atmospheric reddening that deepens to
// orange as the sun sinks toward the horizon. coverage occludes it behind clouds.
vec4 sun(float coverage) {
    vec3 sun_dir = normalize(sun_world_dir);
    if(sun_dir.y < -0.05)
        return vec4(0.0);

    vec3 view = normalize(v_direction);
    float ang = acos(clamp(dot(view, sun_dir), -1.0, 1.0)); // radians from the centre

    const float disc_r = 0.05; // angular radius of the solid disc

    // Solid disc with a soft, anti-aliased rim.
    float disc = 1.0 - smoothstep(disc_r * 0.8, disc_r, ang);

    // Corona: a tight bright bloom hugging the disc plus a broad faint halo, both
    // exponential so they fade smoothly into the sky rather than ending in a band.
    float corona = exp(-ang / 0.035) * 0.55 + exp(-ang / 0.16) * 0.35;

    // Redden toward the horizon: 0 high in the sky, 1 as the sun nears/sets.
    float low = smoothstep(0.30, -0.05, sun_dir.y);

    // Fade the whole sun out over the last few degrees before it dips below the
    // horizon (the early-out below), so the bright orange eases away instead of
    // snapping off when the sun switches off.
    float set_fade = smoothstep(-0.05, 0.08, sun_dir.y);

    // Broad warm atmospheric glow: a wide yellow/orange wash the surrounding sky
    // takes on, present even at midday but flaring much wider and deeper into
    // orange as the sun sets, so sunsets bathe the nearby sky in colour.
    float sky_glow = exp(-ang / mix(0.35, 0.7, low)) * (0.22 + 0.85 * low);

    vec3 core_col = mix(vec3(1.0, 0.98, 0.92), vec3(1.0, 0.72, 0.42), low);
    vec3 glow_col = mix(vec3(1.0, 0.83, 0.55), vec3(1.0, 0.42, 0.16), low);
    vec3 sky_glow_col = mix(vec3(1.0, 0.80, 0.42), vec3(1.0, 0.45, 0.14), low);

    // Blend the three layers (broad sky glow, corona, opaque disc) weighted by
    // their strengths so the white-hot core wins at the centre and the warm wash
    // takes over outward, then composite the whole thing over the sky.
    float total = disc + corona + sky_glow;
    vec3 colour = (core_col * disc + glow_col * corona + sky_glow_col * sky_glow) / max(total, 1e-4);
    float alpha = clamp(total, 0.0, 1.0) * (1.0 - coverage) * set_fade;
    return vec4(colour, alpha);
}

// A textured lunar disc: a sphere-shaded face (limb darkening toward the rim) with
// darker maria and fine crater speckle from fBm, plus a faint cool halo. It sits
// antipodal to the sun, so it always reads as a full moon. coverage occludes it.
vec4 moon(float coverage) {
    vec3 moon_dir = normalize(moon_world_dir);
    if(moon_dir.y < -0.05)
        return vec4(0.0);

    vec3 view = normalize(v_direction);
    float ang = acos(clamp(dot(view, moon_dir), -1.0, 1.0));

    const float disc_r = 0.045;

    // A stable tangent frame on the moon gives the face fixed surface coords, so
    // the maria don't swim as the moon arcs across the sky.
    vec3 ref = abs(moon_dir.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
    vec3 right = normalize(cross(ref, moon_dir));
    vec3 up = cross(moon_dir, right);
    vec2 face = vec2(dot(view, right), dot(view, up)) / disc_r; // ~unit disc
    float r = length(face);

    float disc = 1.0 - smoothstep(0.97, 1.0, r);

    // Read the disc as a sphere: foreshorten toward the limb so the rim darkens.
    float z = sqrt(max(1.0 - r * r, 0.0));
    float limb = mix(0.45, 1.0, z);

    // Surface: broad maria (low-frequency) plus fine crater speckle, kept gentle
    // and clamped so it always reads as subtle greys rather than harsh blotches.
    float maria = fbm(face * 1.3 + 7.0);
    float craters = fbm(face * 7.0 + 21.0);
    float surface = clamp(0.8 + 1.6 * maria + 0.5 * craters, 0.45, 1.05);

    vec3 moon_col = vec3(0.93, 0.94, 0.98) * limb * surface;

    // Faint cool halo just outside the disc.
    float halo = exp(-max(ang - disc_r, 0.0) / 0.05) * 0.18;
    vec3 halo_col = vec3(0.55, 0.65, 0.95);

    vec3 colour = mix(halo_col, moon_col, disc);
    float alpha = clamp(disc + halo, 0.0, 1.0) * (1.0 - coverage);
    return vec4(colour, alpha);
}

void main() {
    float elevation = clamp(v_direction.y, 0.0, 1.0);
    vec3 sky_colour = mix(mix(night_colour2, night_colour1, elevation), mix(day_colour2, day_colour1, elevation), day_factor);

    CloudResult cloud_layer = CloudResult(sky_colour, 0.0);
    if(cloud_display)
        cloud_layer = clouds(sky_colour);
    vec3 result = cloud_layer.colour;

    if(sun_moon_display) {
        vec4 sun_layer = sun(cloud_layer.coverage);
        result = mix(result, sun_layer.rgb, sun_layer.a);

        vec4 moon_layer = moon(cloud_layer.coverage);
        result = mix(result, moon_layer.rgb, moon_layer.a);
    }

    gl_FragColor = vec4(result, 1.0);
}
