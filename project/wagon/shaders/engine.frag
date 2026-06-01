#ifdef GL_ES
precision highp float;
#endif

// Engine shader: a procedural metallic block (no texture — the model carries no
// UVs), lit by the abstract sun with a Blinn-Phong specular highlight so it reads
// as a hard machined surface, faded by a faint fresnel rim, and shadowed by the
// terrain + wagon shadow maps exactly like the wagon body and horses. It is drawn
// into the wagon depth map in the depth pass, so it also casts onto the body.
varying vec3 v_normal;
varying vec3 v_view_pos;
varying float v_fog_depth;

uniform vec3 u_sun_eye_dir;    // sun direction in eye space (the abstract sun)
uniform vec3 u_moon_eye_dir;   // moon direction in eye space (cool night fill)
uniform float u_sun_intensity; // direct sun strength: 1 by day, lifted as it sets, faded to 0 below the horizon
uniform vec3 u_sun_tint;       // warm multiplier on the sunlight, white by day, orange as it sets
uniform float u_moon_intensity; // 0..1, faded to 0 over the 0 -> -2 deg horizon band

uniform bool u_fog_enabled;    // distance-fog toggle (shared with the terrain)
uniform vec3 u_fog_color;      // horizon colour the distance fades into
uniform float u_fog_near;      // view depth where the fog begins
uniform float u_fog_far;       // view depth where the fog is full

// Cast-iron / aluminium engine block: a dark, slightly cool metal that lets the
// specular highlight and rim do the work of reading as machined metal.
const vec3 ENGINE_BASE = vec3(0.22, 0.235, 0.255);
const vec3 SPEC_COLOR = vec3(1.0, 0.97, 0.9); // near-white metal highlight
const float SHININESS = 48.0;                 // tight, hard specular lobe
const vec3 MOON_COLOR = vec3(0.12, 0.16, 0.26); // very dim, dark-cool moonlight

// --- Sun shadows (same maps and uniforms as the terrain/wagon/horse shaders) ---
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

// Sun visibility: the darker of the terrain shadow and the wagon's own map (the
// wagon map holds the engine too, so it shadows itself and the body around it).
float sun_shadow(vec3 view_pos, float ndl) {
    if(!u_shadow_enabled)
        return 1.0;
    float terrain_s = terrain_shadow(view_pos, ndl);
    float wagon_s = u_wagon_shadow_on ? sample_shadow(u_wagon_shadow_map, u_wagon_light_vp, view_pos, slope_bias(u_wagon_shadow_bias, ndl), u_wagon_shadow_texel) : -1.0;
    return min(terrain_s, wagon_s < 0.0 ? 1.0 : wagon_s);
}

void main() {
    vec3 N = normalize(v_normal);
    vec3 V = normalize(-v_view_pos); // viewer at the eye-space origin
    vec3 L = normalize(u_sun_eye_dir);
    vec3 Lm = normalize(u_moon_eye_dir);
    float ndl = max(dot(N, L), 0.0);
    float moon_ndl = max(dot(N, Lm), 0.0);

    // The shadow maps cast from whichever light is above the horizon; bias the
    // lookup against that active caster's grazing angle.
    vec3 cast_L = u_sun_intensity >= u_moon_intensity ? L : Lm;
    float ndl_cast = max(dot(N, cast_L), 0.0);

    // Small normal-offset bias. The wagon depth map stores back faces (front-face
    // culling), so self-shadow acne is already prevented geometrically and the
    // offset can stay tiny; a faint grazing term still guards against terrain
    // shadows acne-ing on the block.
    vec3 sample_pos = v_view_pos + N * (0.02 + 0.05 * (1.0 - ndl_cast));

    float shadow = sun_shadow(sample_pos, ndl_cast);

    // Blinn-Phong specular: a tight highlight that only the lit, unshadowed faces
    // catch, so edges and curves of the block flash like machined metal.
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(N, H), 0.0), SHININESS) * ndl;

    // A faint fresnel rim lifts the grazing silhouette, the way light wraps a
    // metal casting, keeping the block from reading as a flat matte solid.
    float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0) * 0.25;

    // Cool ambient fill (never black) + the sun's diffuse and specular, both
    // darkened by the shadow and scaled by the day/night sun intensity.
    vec3 ambient = ENGINE_BASE * (0.32 + rim);
    vec3 diffuse = ENGINE_BASE * u_sun_tint * ndl * shadow * 0.7 * u_sun_intensity;
    vec3 specular = SPEC_COLOR * u_sun_tint * spec * shadow * 0.6 * u_sun_intensity;

    // Cool moonlight: a second, very dim directional term, self-gated by its own
    // N.L (zero by day) and shadowed by the same maps as the sun.
    vec3 moon = ENGINE_BASE * MOON_COLOR * moon_ndl * shadow * 0.7 * u_moon_intensity;

    vec3 color = ambient + diffuse + specular + moon;

    // Distance fog: dissolve into the same horizon haze as the wagon it rides on.
    if(u_fog_enabled) {
        float fog = smoothstep(u_fog_near, u_fog_far, v_fog_depth);
        color = mix(color, u_fog_color, fog);
    }

    gl_FragColor = vec4(color, 1.0);
}
