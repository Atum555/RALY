#ifdef GL_ES
precision highp float;
#endif

varying vec2 v_terrain_uv;
varying vec3 v_normal;   // view-space geometric normal
varying vec3 v_tangent;  // view-space tangent (along +U of a_terrain_uv)
varying vec3 v_view_pos; // view-space fragment position
varying float v_fog_depth;
varying float v_path_dist; // normalized distance to nearest path: 0 = centre, 1 = transition end

uniform float u_tex_repeat;     // base frequency of the material tiling
uniform float u_path_dirt_edge; // normalized distance at which solid path ends and the transition begins

// --- Two tiled PBR materials ------------------------------------------------
// The open ground is rocky terrain; the dirt paths are gravelly sand. Each set
// is: diffuse albedo, an OpenGL-convention tangent-space normal map, the packed
// ARM map (R = ambient occlusion, G = roughness, B = metalness) and a
// height/displacement map driving parallax (bump offset).
uniform sampler2D u_rock_diffuse_map;
uniform sampler2D u_rock_normal_map;
uniform sampler2D u_rock_arm_map;
uniform sampler2D u_rock_disp_map;
uniform sampler2D u_diffuse_map; // gravelly-sand path
uniform sampler2D u_normal_map;
uniform sampler2D u_arm_map;
uniform sampler2D u_disp_map;
uniform float u_parallax_scale; // depth of the parallax effect, in tiled-UV units
uniform float u_parallax_near;  // full parallax within this view distance
uniform float u_parallax_far;   // parallax faded out (and skipped) beyond this

// --- The sun and moon -------------------------------------------------------
// Two directional lights. Their eye-space directions are supplied by ShadowMap
// each frame, so they arc across the sky with the day/night cycle. The sun
// (u_sun_eye_dir) casts shadows; the moon (u_moon_eye_dir) is a cool, dim,
// unshadowed fill that only contributes while it is above the horizon (its N.L
// is clamped to zero by day, when it is below).
uniform vec3 u_sun_eye_dir;
uniform vec3 u_moon_eye_dir;
uniform float u_sun_intensity;  // 0..1, faded to 0 over the 0 -> -2 deg horizon band
uniform float u_moon_intensity; // 0..1, faded to 0 over the 0 -> -2 deg horizon band

// --- Distance fog -----------------------------------------------------------
uniform bool u_fog_enabled;
uniform vec3 u_fog_color;
uniform float u_fog_near;
uniform float u_fog_far;

// --- Sun shadows (three dedicated maps) -------------------------------------
// A whole-terrain map, a near map that follows the wagon and the wagon's own
// map, all re-rendered every frame as the sun arcs across the sky. Each
// *_light_vp maps an eye-space position into that map's light-clip space; a
// fragment is shadowed if any map occludes the sun. The shadow only darkens the
// sun term, never the ambient fill.
uniform bool u_shadow_enabled;
uniform sampler2D u_terrain_shadow_map;      // whole terrain
uniform sampler2D u_terrain_near_shadow_map; // small, follows the wagon (overrides the whole map)
uniform sampler2D u_wagon_shadow_map;        // the wagon's own silhouette
uniform mat4 u_terrain_light_vp;      // eye-space -> whole-terrain map light clip
uniform mat4 u_terrain_near_light_vp; // eye-space -> near-terrain map light clip
uniform mat4 u_wagon_light_vp;        // eye-space -> wagon map light clip
uniform float u_terrain_shadow_texel; // 1.0 / map resolution (for PCF)
uniform float u_terrain_near_shadow_texel;
uniform float u_wagon_shadow_texel;
uniform vec2 u_terrain_shadow_bias;   // (min, max) slope-scaled depth bias
uniform vec2 u_terrain_near_shadow_bias;
uniform vec2 u_wagon_shadow_bias;
uniform bool u_terrain_shadow_on;      // per-map toggles (UI); off => map skipped, treated as lit
uniform bool u_terrain_near_shadow_on;
uniform bool u_wagon_shadow_on;

const vec3 SUN_COLOR = vec3(1.0, 0.96, 0.88);     // warm sunlight (used on the dirt)
const vec3 MOON_COLOR = vec3(0.12, 0.16, 0.26);   // very dim, dark-cool moonlight
const vec3 SKY_AMBIENT = vec3(0.22, 0.25, 0.32);  // cool fill for shadowed dirt slopes

// --- Value noise + fBm, so the grass varies without any image texture ---
float hash(vec2 p) {
    p = fract(p * vec2(123.34, 345.45));
    p += dot(p, p + 34.345);
    return fract(p.x * p.y);
}

float value_noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0); // quintic: smoother, less grid-blocky
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
    float v = 0.0;
    float amp = 0.5;
    for(int i = 0; i < 5; i++) {
        v += amp * value_noise(p);
        p *= 2.0;
        amp *= 0.5;
    }
    return v;
}

// --- Stochastic "texture bombing" to break up visible tiling ----------------
// An exactly-repeating texture reads as a regular lattice at large scales. We lay
// an invisible grid of cells over the UVs (UNTILE_CELL tiles per cell); each cell
// gets a random rotation, scale and offset, so its patch of the material differs
// from its neighbors and the lattice dissolves. The four cells around a fragment
// are bilinearly blended (with a narrowed transition band) so there are no seams.
const float UNTILE_CELL = 1.5;       // cell size in texture tiles; smaller = more variety
const float UNTILE_ROTATION = 6.2831853; // per-cell rotation range, radians (2*PI = full)
const float UNTILE_SCALE = 0.2;      // per-cell scale jitter, +/- fraction
const float UNTILE_BRIGHT = 0.11;    // brightness variation, +/- fraction
const float UNTILE_HUE = 0.04;       // warm/cool tint variation, +/- fraction
const float UNTILE_BRIGHT_FREQ = 0.9; // frequency of both, in texture tiles (higher = smaller patches)

vec3 cell_hash(vec2 cell) {
    float n = dot(cell, vec2(127.1, 311.7));
    return fract(sin(vec3(n, n + 1.7, n + 3.3)) * 43758.5453);
}

vec2 rot2(vec2 v, float a) {
    float s = sin(a), c = cos(a);
    return mat2(c, -s, s, c) * v;
}

// Random rotate/scale/translate of the lookup UV for one cell. `angle` is written
// out so a fetched normal can be rotated back into the surface tangent frame.
vec2 cell_uv(vec2 uv, vec2 cell, out float angle) {
    vec3 h = cell_hash(cell);
    angle = (h.x - 0.5) * UNTILE_ROTATION;
    float scale = 1.0 + (h.y - 0.5) * 2.0 * UNTILE_SCALE;
    vec2 offset = h.xy * 17.0;            // decorrelating translation
    return rot2(uv, -angle) * scale + offset;
}

// Bilinear blend of a material's three maps over the four cells around the
// fragment, in a single pass. The per-cell rotation/scale/offset (the trig-heavy
// cell_uv) and the blend weights are computed once per cell and shared by all
// three fetches. The transition band is narrowed with smoothstep so blurry
// cross-fades stay thin. Each cell's normal.xy is rotated by that cell's angle so
// the bumps stay aligned with the rotated patch; `out_nm` is the unnormalized
// tangent-space normal and the caller builds the world normal.
void bomb_material(sampler2D diff_tex, sampler2D arm_tex, sampler2D norm_tex, vec2 uv, out vec3 out_albedo, out vec3 out_arm, out vec3 out_nm) {
    vec2 cc = uv / UNTILE_CELL;
    vec2 ci = floor(cc);
    vec2 cf = smoothstep(0.35, 0.65, fract(cc));
    out_albedo = vec3(0.0);
    out_arm = vec3(0.0);
    out_nm = vec3(0.0);
    for(int j = 0; j <= 1; j++) {
        for(int i = 0; i <= 1; i++) {
            vec2 cell = ci + vec2(float(i), float(j));
            float a;
            vec2 luv = cell_uv(uv, cell, a);
            float w = (i == 0 ? 1.0 - cf.x : cf.x) * (j == 0 ? 1.0 - cf.y : cf.y);
            out_albedo += texture2D(diff_tex, luv).rgb * w;
            out_arm += texture2D(arm_tex, luv).rgb * w;
            vec3 nm = texture2D(norm_tex, luv).rgb * 2.0 - 1.0;
            nm.xy = rot2(nm.xy, a);
            out_nm += nm * w;
        }
    }

    // Mottle the tone with continuous noise fields that are unrelated to the cell
    // lattice, so the repeating light/dark blotches break up without introducing a
    // grid of their own (which a per-cell jitter would). Brightness is one field; a
    // second, decorrelated field drifts the patch warm or cool along a red<->blue
    // axis, so colour repeats too instead of only luminance.
    out_albedo *= 1.0 + (fbm(uv * UNTILE_BRIGHT_FREQ) - 0.5) * 2.0 * UNTILE_BRIGHT;
    float tint = (fbm(uv * UNTILE_BRIGHT_FREQ + 31.0) - 0.5) * 2.0 * UNTILE_HUE;
    out_albedo *= 1.0 + tint * vec3(1.0, 0.0, -1.0);
}

// Parallax-occlusion mapping. March the view ray through the heightfield instead
// of taking the old single bump-offset tap, so deep relief stays put at grazing
// angles instead of swimming. vt is the view direction (frag -> eye) in tangent
// space; vt.z > 0 faces the camera. The disp map is read as depth (1 - height),
// so taller areas sit nearer the surface; we step down in layers until the ray
// crosses the surface, then interpolate the crossing for a sub-layer hit.
vec2 parallax_uv(sampler2D disp_map, vec2 uv, vec3 vt, float fade) {
    // Far fragments skip the whole march: the relief is invisible at distance and
    // it is by far the most expensive part of the shader.
    if(fade <= 0.0)
        return uv;

    const int MAX_LAYERS = 32;
    // Fewer layers head-on (cheap, little to resolve), more at grazing angles
    // where the offset is largest and stair-stepping would show; and fewer as the
    // effect fades out with distance.
    float num_layers = mix(8.0, 32.0, 1.0 - clamp(vt.z, 0.0, 1.0)) * fade;
    float layer_depth = 1.0 / num_layers;

    // Total UV travel from the surface to the deepest layer; /vt.z gives the
    // correct horizontal shift per unit depth (clamped so it can't blow up). The
    // fade scales the depth so the relief eases off rather than popping away.
    vec2 P = (vt.xy / max(vt.z, 0.2)) * u_parallax_scale * fade;
    vec2 delta_uv = P / num_layers;

    float cur_depth = 0.0;
    vec2 cur_uv = uv;
    float cur_height = 1.0 - texture2D(disp_map, cur_uv).r;
    for(int i = 0; i < MAX_LAYERS; i++) {
        if(cur_depth >= cur_height)
            break;
        cur_uv -= delta_uv;
        cur_height = 1.0 - texture2D(disp_map, cur_uv).r;
        cur_depth += layer_depth;
    }

    // Interpolate the crossing between the last two layers (the "occlusion"
    // refinement that removes the stair-stepping of plain steep parallax).
    vec2 prev_uv = cur_uv + delta_uv;
    float after = cur_height - cur_depth;
    float before = (1.0 - texture2D(disp_map, prev_uv).r) - (cur_depth - layer_depth);
    float w = clamp(after / (after - before), 0.0, 1.0);
    return mix(cur_uv, prev_uv, w);
}

// --- Shadow lookup ----------------------------------------------------------

// 3x3 percentage-closer filter over one depth map: average how many of the nine
// taps the fragment (depth `ref`) is in front of, softening the shadow edge.
// `ref` is the fragment's depth in that map, in [0, 1]; `texel` is 1/resolution.
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

// Project an eye-space position into one map and sample it. Returns 1 = lit,
// 0 = fully shadowed, or -1 when the fragment falls outside the map (so the
// caller can fall through to another map / treat it as lit). A small border keeps
// PCF taps from reading past the map edge.
float sample_shadow(sampler2D smap, mat4 m, vec3 view_pos, float bias, float texel) {
    vec4 lp = m * vec4(view_pos, 1.0);
    vec3 uvz = (lp.xyz / lp.w) * 0.5 + 0.5; // ortho clip -> [0, 1]

    float b = 2.0 * texel; // one PCF tap of slack at the border
    if(uvz.x < b || uvz.x > 1.0 - b || uvz.y < b || uvz.y > 1.0 - b || uvz.z > 1.0)
        return -1.0;

    return pcf(smap, uvz.xy, uvz.z - bias, texel);
}

// `ndl` is the geometric N.L, used to scale a map's depth bias up on grazing
// slopes where acne is worst.
float slope_bias(vec2 band, float ndl) {
    return max(band.y * (1.0 - ndl), band.x);
}

// Terrain self-shadow: prefer the sharp near map; where the fragment is outside
// it, fall back to the whole-terrain map; lit if outside both.
float terrain_shadow(vec3 view_pos, float ndl) {
    float ns = u_terrain_near_shadow_on ? sample_shadow(u_terrain_near_shadow_map, u_terrain_near_light_vp, view_pos, slope_bias(u_terrain_near_shadow_bias, ndl), u_terrain_near_shadow_texel) : -1.0;
    if(ns >= 0.0)
        return ns;
    float fs = u_terrain_shadow_on ? sample_shadow(u_terrain_shadow_map, u_terrain_light_vp, view_pos, slope_bias(u_terrain_shadow_bias, ndl), u_terrain_shadow_texel) : -1.0;
    return fs < 0.0 ? 1.0 : fs;
}

// Sun visibility at this fragment: the darker of the terrain self-shadow and the
// wagon's cast shadow, so a fragment is shadowed if either occludes the sun.
float sun_shadow(vec3 view_pos, float ndl) {
    if(!u_shadow_enabled)
        return 1.0;
    float terrain_s = terrain_shadow(view_pos, ndl);
    float wagon_s = u_wagon_shadow_on ? sample_shadow(u_wagon_shadow_map, u_wagon_light_vp, view_pos, slope_bias(u_wagon_shadow_bias, ndl), u_wagon_shadow_texel) : -1.0;
    return min(terrain_s, wagon_s < 0.0 ? 1.0 : wagon_s);
}

// Sample and fully light one tiled PBR set at the current fragment. T/B/n_geom
// are the eye-space tangent frame, L the light and V the view direction. The
// displacement map drives parallax-occlusion mapping, then albedo/ARM/normal are
// read at the parallaxed UVs and lit with a warm sun plus cool ambient fill and
// a roughness-shaped specular highlight.
vec3 lit_material(
    sampler2D diff_map,
    sampler2D norm_map,
    sampler2D arm_map,
    sampler2D disp_map,
    vec2 uv,
    vec3 T,
    vec3 B,
    vec3 n_geom,
    vec3 L,
    vec3 Lm,
    vec3 V,
    float p_fade,
    float shadow
) {
    vec3 vt = vec3(dot(V, T), dot(V, B), dot(V, n_geom));
    vec2 uvr = parallax_uv(disp_map, uv, vt, p_fade);

    vec3 albedo, arm, nm;
    bomb_material(diff_map, arm_map, norm_map, uvr, albedo, arm, nm);
    float ao = arm.r;
    float roughness = clamp(arm.g, 0.04, 1.0);
    vec3 N = normalize(T * nm.x + B * nm.y + n_geom * nm.z);
    float shininess = mix(4.0, 128.0, 1.0 - roughness);

    vec3 hh = normalize(L + V);
    float diffuse = max(dot(N, L), 0.0);
    float spec = pow(max(dot(N, hh), 0.0), shininess) * (1.0 - roughness);

    // Moonlight: a second, cooler directional term. Self-gating (its N.L is zero
    // when the moon is below the horizon by day) and very dim, so it reads as a
    // dark night key light. The shadow maps cast from whichever light is up, so it
    // is shadowed just like the sun (only one of the two is ever lit at a time).
    vec3 hm = normalize(Lm + V);
    float moon_diffuse = max(dot(N, Lm), 0.0);
    float moon_spec = pow(max(dot(N, hm), 0.0), shininess) * (1.0 - roughness);

    // The shadow darkens the active light's direct diffuse and specular; only the
    // cool sky-ambient fill stays unshadowed so slopes don't go black. Each light's
    // direct term is also faded to zero as it drops below the horizon.
    float sun = shadow * u_sun_intensity;
    float moon = shadow * u_moon_intensity;
    return albedo * (SKY_AMBIENT * ao + SUN_COLOR * diffuse * sun + MOON_COLOR * moon_diffuse * moon) + SUN_COLOR * spec * diffuse * sun * 0.4 + MOON_COLOR * moon_spec * moon_diffuse * moon * 0.4;
}

void main() {
    // Global terrain coords scaled by u_tex_repeat give the noise its base
    // frequency; because the noise never repeats, there is no tiling seam.
    vec2 uv = v_terrain_uv * u_tex_repeat;

    vec3 n_geom = normalize(v_normal);
    vec3 L = normalize(u_sun_eye_dir);
    vec3 Lm = normalize(u_moon_eye_dir);
    vec3 V = normalize(-v_view_pos);

    // --- Two textured surfaces: rocky open ground, gravelly-sand path ------
    // Tangent frame in eye space: Gram-Schmidt the interpolated tangent against
    // the normal, then the bitangent runs along +V (cross(T, N)). Both materials
    // share this frame; each samples and lights its own map set.
    vec3 T = normalize(v_tangent - n_geom * dot(n_geom, v_tangent));
    vec3 B = cross(T, n_geom);

    // Parallax only near the camera: full within u_parallax_near, off past
    // u_parallax_far. Beyond that the march is skipped entirely (see parallax_uv).
    float p_fade = 1.0 - smoothstep(u_parallax_near, u_parallax_far, length(v_view_pos));

    // Shadow from the terrain + wagon maps, which cast from whichever light is up;
    // the bias is driven by the geometric N.L against that active caster. Shared by
    // both materials -- it depends on the surface, not the map.
    vec3 cast_L = u_sun_intensity >= u_moon_intensity ? L : Lm;
    float shadow = sun_shadow(v_view_pos, max(dot(n_geom, cast_L), 0.0));

    // --- Open ground <-> path transition (unchanged edge logic) ------------
    // v_path_dist is the per-vertex normalized distance to the nearest path; we
    // perturb it with tuft-scale, rotated multi-octave fBm and threshold it so
    // the band between path and open ground breaks into natural fingers.
    float dist = v_path_dist;
    mat2 rot = mat2(0.80, -0.60, 0.60, 0.80);
    float breakup = fbm(uv * 5.0 + 53.0) * 0.5 + fbm(rot * uv * 13.0 + 17.0) * 0.3 + fbm(rot * rot * uv * 30.0 + 91.0) * 0.2;
    float edge = dist + (breakup - 0.5) * 0.22;
    float path_amount = 1.0 - smoothstep(u_path_dirt_edge, 1.0, edge);

    // Only the noisy edge band needs both materials; the open ground and the
    // solid path are pure, so there we light just the one that shows and skip
    // the other's parallax march and texture taps entirely.
    vec3 lit_color;
    if(path_amount <= 0.001) {
        lit_color = lit_material(u_rock_diffuse_map, u_rock_normal_map, u_rock_arm_map, u_rock_disp_map, uv, T, B, n_geom, L, Lm, V, p_fade, shadow);
    } else if(path_amount >= 0.999) {
        lit_color = lit_material(u_diffuse_map, u_normal_map, u_arm_map, u_disp_map, uv, T, B, n_geom, L, Lm, V, p_fade, shadow);
    } else {
        vec3 lit_rock = lit_material(u_rock_diffuse_map, u_rock_normal_map, u_rock_arm_map, u_rock_disp_map, uv, T, B, n_geom, L, Lm, V, p_fade, shadow);
        vec3 lit_path = lit_material(u_diffuse_map, u_normal_map, u_arm_map, u_disp_map, uv, T, B, n_geom, L, Lm, V, p_fade, shadow);
        // Blend the two fully-lit surfaces along the noisy path edge.
        lit_color = mix(lit_rock, lit_path, path_amount);
    }

    // Distance fog: fade the lit colour into the horizon colour over the
    // near..far band, so distant terrain dissolves into the sky.
    if(u_fog_enabled) {
        float fog = smoothstep(u_fog_near, u_fog_far, v_fog_depth);
        lit_color = mix(lit_color, u_fog_color, fog);
    }

    gl_FragColor = vec4(lit_color, 1.0);
}
