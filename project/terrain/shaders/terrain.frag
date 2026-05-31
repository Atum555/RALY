#ifdef GL_ES
precision highp float;
#endif

varying vec2 v_terrain_uv;
varying vec3 v_normal;   // view-space geometric normal
varying vec3 v_tangent;  // view-space tangent (along +U of a_terrain_uv)
varying vec3 v_view_pos; // view-space fragment position

uniform float u_tex_repeat;     // base frequency of the material tiling

// --- Tiled PBR ground material ----------------------------------------------
// The open ground is rocky terrain. The set is: diffuse albedo, an OpenGL-
// convention tangent-space normal map, the packed ARM map (R = ambient
// occlusion, G = roughness, B = metalness) and a height/displacement map
// driving parallax (bump offset).
uniform sampler2D u_rock_diffuse_map;
uniform sampler2D u_rock_normal_map;
uniform sampler2D u_rock_arm_map;
uniform sampler2D u_rock_disp_map;
uniform float u_parallax_scale; // depth of the parallax effect, in tiled-UV units
uniform float u_parallax_near;  // full parallax within this view distance
uniform float u_parallax_far;   // parallax faded out (and skipped) beyond this

// --- The sun ----------------------------------------------------------------
// A single hardcoded directional light, rotated into eye space with uMVMatrix
// (w = 0 drops the translation) so it stays fixed in the sky as the wagon drives.
uniform mat4 uMVMatrix;

const vec3 SUN_WORLD_DIR = vec3(0.5, 0.8, 0.3);   // high in the sky, off to one side
const vec3 SUN_COLOR = vec3(1.0, 0.96, 0.88);     // warm sunlight (used on the dirt)
const vec3 SKY_AMBIENT = vec3(0.32, 0.36, 0.45);  // cool fill for shadowed dirt slopes

// --- Stochastic "texture bombing" to break up visible tiling ----------------
// An exactly-repeating texture reads as a regular lattice at large scales. We lay
// an invisible grid of cells over the UVs (UNTILE_CELL tiles per cell); each cell
// gets a random rotation, scale and offset, so its patch of the material differs
// from its neighbors and the lattice dissolves. The four cells around a fragment
// are bilinearly blended (with a narrowed transition band) so there are no seams.
const float UNTILE_CELL = 3.0;       // cell size in texture tiles; smaller = more variety
const float UNTILE_ROTATION = 6.2831853; // per-cell rotation range, radians (2*PI = full)
const float UNTILE_SCALE = 0.2;      // per-cell scale jitter, +/- fraction

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

// Bilinear blend of one map over the four cells around the fragment. The
// transition band is narrowed with smoothstep so blurry cross-fades stay thin.
vec4 bomb_sample(sampler2D tex, vec2 uv) {
    vec2 cc = uv / UNTILE_CELL;
    vec2 ci = floor(cc);
    vec2 cf = smoothstep(0.35, 0.65, fract(cc));
    vec4 sum = vec4(0.0);
    for (int j = 0; j <= 1; j++) {
        for (int i = 0; i <= 1; i++) {
            vec2 cell = ci + vec2(float(i), float(j));
            float a;
            vec2 luv = cell_uv(uv, cell, a);
            float w = (i == 0 ? 1.0 - cf.x : cf.x) * (j == 0 ? 1.0 - cf.y : cf.y);
            sum += texture2D(tex, luv) * w;
        }
    }
    return sum;
}

// Same blend for a tangent-space normal map: each cell's normal.xy is rotated by
// that cell's angle so the bumps stay aligned with the rotated patch. Result is
// the unnormalized tangent-space normal; the caller builds the world normal.
vec3 bomb_normal(sampler2D tex, vec2 uv) {
    vec2 cc = uv / UNTILE_CELL;
    vec2 ci = floor(cc);
    vec2 cf = smoothstep(0.35, 0.65, fract(cc));
    vec3 sum = vec3(0.0);
    for (int j = 0; j <= 1; j++) {
        for (int i = 0; i <= 1; i++) {
            vec2 cell = ci + vec2(float(i), float(j));
            float a;
            vec2 luv = cell_uv(uv, cell, a);
            vec3 nm = texture2D(tex, luv).rgb * 2.0 - 1.0;
            nm.xy = rot2(nm.xy, a);
            float w = (i == 0 ? 1.0 - cf.x : cf.x) * (j == 0 ? 1.0 - cf.y : cf.y);
            sum += nm * w;
        }
    }
    return sum;
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
    if (fade <= 0.0) return uv;

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
    for (int i = 0; i < MAX_LAYERS; i++) {
        if (cur_depth >= cur_height) break;
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

// Sample and fully light one tiled PBR set at the current fragment. T/B/n_geom
// are the eye-space tangent frame, L the light and V the view direction. The
// displacement map drives parallax-occlusion mapping, then albedo/ARM/normal are
// read at the parallaxed UVs and lit with a warm sun plus cool ambient fill and
// a roughness-shaped specular highlight.
vec3 lit_material(sampler2D diff_map, sampler2D norm_map, sampler2D arm_map, sampler2D disp_map,
                 vec2 uv, vec3 T, vec3 B, vec3 n_geom, vec3 L, vec3 V, float p_fade) {
    vec3 vt = vec3(dot(V, T), dot(V, B), dot(V, n_geom));
    vec2 uvr = parallax_uv(disp_map, uv, vt, p_fade);

    vec3 albedo = bomb_sample(diff_map, uvr).rgb;
    vec3 arm = bomb_sample(arm_map, uvr).rgb;
    float ao = arm.r;
    float roughness = clamp(arm.g, 0.04, 1.0);

    vec3 nm = bomb_normal(norm_map, uvr);
    vec3 N = normalize(T * nm.x + B * nm.y + n_geom * nm.z);

    vec3 hh = normalize(L + V);
    float diffuse = max(dot(N, L), 0.0);
    float shininess = mix(4.0, 128.0, 1.0 - roughness);
    float spec = pow(max(dot(N, hh), 0.0), shininess) * (1.0 - roughness);

    return albedo * (SKY_AMBIENT * ao + SUN_COLOR * diffuse) + SUN_COLOR * spec * diffuse * 0.4;
}

void main() {
    // Global terrain coords scaled by u_tex_repeat give the material its base
    // tiling frequency.
    vec2 uv = v_terrain_uv * u_tex_repeat;

    vec3 n_geom = normalize(v_normal);
    vec3 L = normalize((uMVMatrix * vec4(SUN_WORLD_DIR, 0.0)).xyz);
    vec3 V = normalize(-v_view_pos);

    // Tangent frame in eye space: Gram-Schmidt the interpolated tangent against
    // the normal, then the bitangent runs along +V (cross(T, N)).
    vec3 T = normalize(v_tangent - n_geom * dot(n_geom, v_tangent));
    vec3 B = cross(T, n_geom);

    // Parallax only near the camera: full within u_parallax_near, off past
    // u_parallax_far. Beyond that the march is skipped entirely (see parallax_uv).
    float p_fade = 1.0 - smoothstep(u_parallax_near, u_parallax_far, length(v_view_pos));

    vec3 lit_color = lit_material(u_rock_diffuse_map, u_rock_normal_map, u_rock_arm_map, u_rock_disp_map,
                               uv, T, B, n_geom, L, V, p_fade);

    gl_FragColor = vec4(lit_color, 1.0);
}
