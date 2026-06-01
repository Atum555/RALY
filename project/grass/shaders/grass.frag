#ifdef GL_ES
precision highp float;
#endif

varying vec3 v_normal;
varying vec3 v_view_pos;
varying float v_local_y;

uniform vec3 u_sun_eye_dir;      // sun direction in eye space (the abstract sun)
uniform vec3 u_moon_eye_dir;     // moon direction in eye space (cool night fill)
uniform float u_sun_intensity;   // 0..1, faded to 0 over the 0 -> -2 deg horizon band
uniform float u_moon_intensity;  // 0..1, faded to 0 over the 0 -> -2 deg horizon band

const vec3 GRASS_TOP = vec3(0.57, 0.65, 0.15);  // bright, light blade tips
const vec3 GRASS_BASE = vec3(0.24, 0.36, 0.11);  // softer, slightly shaded roots
const vec3 MOON_COLOR = vec3(0.12, 0.16, 0.26);  // very dim, dark-cool moonlight

// --- Sun shadows (same maps and uniforms as the terrain/wagon/flower shaders) --
uniform bool u_shadow_enabled;
uniform sampler2D u_terrain_shadow_map;
uniform sampler2D u_terrain_near_shadow_map;
uniform sampler2D u_wagon_shadow_map;
uniform mat4 u_terrain_light_vp;
uniform mat4 u_terrain_near_light_vp;
uniform mat4 u_wagon_light_vp;
uniform float u_terrain_shadow_texel;
uniform float u_terrain_near_shadow_texel;
uniform float u_wagon_shadow_texel;
uniform vec2 u_terrain_shadow_bias;
uniform vec2 u_terrain_near_shadow_bias;
uniform vec2 u_wagon_shadow_bias;
uniform bool u_terrain_shadow_on;      // per-map toggles (UI); off => map skipped, treated as lit
uniform bool u_terrain_near_shadow_on;
uniform bool u_wagon_shadow_on;

// 3x3 percentage-closer filter over one depth map (see terrain.frag).
float pcf(sampler2D smap, vec2 uv, float ref, float texel) {
    float sum = 0.0;
    for(int dy = -1; dy <= 1; dy++) {
        for(int dx = -1; dx <= 1; dx++) {
            float d = texture2D(smap, uv + vec2(float(dx), float(dy)) * texel).r;
            sum += ref <= d ? 1.0 : 0.0;
        }
    }
    return sum / 9.0;
}

// Project an eye-space position into one map: 1 = lit, 0 = shadowed, -1 = outside.
float sample_shadow(sampler2D smap, mat4 m, vec3 view_pos, float bias, float texel) {
    vec4 lp = m * vec4(view_pos, 1.0);
    vec3 uvz = (lp.xyz / lp.w) * 0.5 + 0.5;
    float b = 2.0 * texel;
    if(uvz.x < b || uvz.x > 1.0 - b || uvz.y < b || uvz.y > 1.0 - b || uvz.z > 1.0)
        return -1.0;
    return pcf(smap, uvz.xy, uvz.z - bias, texel);
}

float slope_bias(vec2 band, float ndl) {
    return max(band.y * (1.0 - ndl), band.x);
}

// Terrain self-shadow: prefer the sharp near map, fall back to the whole map.
float terrain_shadow(vec3 view_pos, float ndl) {
    float ns = u_terrain_near_shadow_on ? sample_shadow(u_terrain_near_shadow_map, u_terrain_near_light_vp, view_pos, slope_bias(u_terrain_near_shadow_bias, ndl), u_terrain_near_shadow_texel) : -1.0;
    if(ns >= 0.0)
        return ns;
    float fs = u_terrain_shadow_on ? sample_shadow(u_terrain_shadow_map, u_terrain_light_vp, view_pos, slope_bias(u_terrain_shadow_bias, ndl), u_terrain_shadow_texel) : -1.0;
    return fs < 0.0 ? 1.0 : fs;
}

// Sun visibility: the darker of the terrain maps (which also hold the flowers,
// hay bales and rocks) and the wagon's own map -- so the grass is shadowed by the
// terrain, the wagon, and every other caster around it.
float sun_shadow(vec3 view_pos, float ndl) {
    if(!u_shadow_enabled)
        return 1.0;
    float terrain_s = terrain_shadow(view_pos, ndl);
    float wagon_s = u_wagon_shadow_on ? sample_shadow(u_wagon_shadow_map, u_wagon_light_vp, view_pos, slope_bias(u_wagon_shadow_bias, ndl), u_wagon_shadow_texel) : -1.0;
    return min(terrain_s, wagon_s < 0.0 ? 1.0 : wagon_s);
}

void main() {
    // Blades are thin and drawn from both sides, so flip the normal to face the
    // viewer -- the back of a blade lights like its front instead of going black.
    vec3 N = normalize(v_normal);
    if(!gl_FrontFacing)
        N = -N;

    vec3 L = normalize(u_sun_eye_dir);
    vec3 Lm = normalize(u_moon_eye_dir);
    float ndl = max(dot(N, L), 0.0);
    float moon_ndl = max(dot(N, Lm), 0.0);

    // The maps cast from whichever light is above the horizon; bias against that
    // active caster's grazing angle.
    vec3 cast_L = u_sun_intensity >= u_moon_intensity ? L : Lm;
    float ndl_cast = max(dot(N, cast_L), 0.0);

    // Grass does not cast into the maps itself; it only receives. Push the lookup
    // slightly toward the light and along the normal so a blade reads the ground's
    // shadow under it cleanly rather than speckling on the coarse near-map texels.
    vec3 sample_pos = v_view_pos + cast_L * 0.12 + N * (0.03 + 0.05 * (1.0 - ndl_cast));
    float shadow = sun_shadow(sample_pos, ndl_cast);

    // Darken toward the root so the blades read as tufts rather than flat green.
    vec3 base = mix(GRASS_BASE, GRASS_TOP, clamp(v_local_y, 0.0, 1.0));

    // A fill that never goes black, plus the sun's diffuse that the shadow darkens,
    // plus the same cool moon term the other surfaces use. The blade normals are
    // rounded toward up (see grass.vert), so every blade now catches the sun evenly
    // like the ground does -- these weights are kept modest so the field sits at the
    // terrain's brightness instead of glowing as if self-lit.
    vec3 ambient = base * 0.12;
    vec3 diffuse = base * ndl * shadow * 0.45 * u_sun_intensity;
    vec3 moon = base * MOON_COLOR * moon_ndl * shadow * 0.75 * u_moon_intensity;
    gl_FragColor = vec4(ambient + diffuse + moon, 1.0);
}
