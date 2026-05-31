#ifdef GL_ES
precision highp float;
#endif

varying vec3 v_normal;
varying vec3 v_view_pos;

uniform vec3 u_wagon_color;  // soft solid base colour
uniform vec3 u_sun_eye_dir;  // sun direction in eye space (the abstract sun)

// --- Sun shadows (same maps and uniforms as the terrain shader) -------------
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

// 3x3 percentage-closer filter over one depth map (see terrain.frag).
float pcf(sampler2D smap, vec2 uv, float ref, float texel) {
    float sum = 0.0;
    for (int dy = -1; dy <= 1; dy++) {
        for (int dx = -1; dx <= 1; dx++) {
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
    if (uvz.x < b || uvz.x > 1.0 - b || uvz.y < b || uvz.y > 1.0 - b || uvz.z > 1.0) return -1.0;
    return pcf(smap, uvz.xy, uvz.z - bias, texel);
}

float slope_bias(vec2 band, float ndl) {
    return max(band.y * (1.0 - ndl), band.x);
}

// Terrain self-shadow: prefer the sharp near map, fall back to the whole map.
float terrain_shadow(vec3 view_pos, float ndl) {
    float ns = sample_shadow(u_terrain_near_shadow_map, u_terrain_near_light_vp, view_pos,
                             slope_bias(u_terrain_near_shadow_bias, ndl), u_terrain_near_shadow_texel);
    if (ns >= 0.0) return ns;
    float fs = sample_shadow(u_terrain_shadow_map, u_terrain_light_vp, view_pos,
                             slope_bias(u_terrain_shadow_bias, ndl), u_terrain_shadow_texel);
    return fs < 0.0 ? 1.0 : fs;
}

// Sun visibility: the darker of the terrain shadow and the wagon's own map (so
// the body shadows itself and is shadowed by the terrain).
float sun_shadow(vec3 view_pos, float ndl) {
    if (!u_shadow_enabled) return 1.0;
    float terrain_s = terrain_shadow(view_pos, ndl);
    float wagon_s = sample_shadow(u_wagon_shadow_map, u_wagon_light_vp, view_pos,
                                  slope_bias(u_wagon_shadow_bias, ndl), u_wagon_shadow_texel);
    return min(terrain_s, wagon_s < 0.0 ? 1.0 : wagon_s);
}

void main() {
    vec3 N = normalize(v_normal);
    vec3 L = normalize(u_sun_eye_dir);
    float ndl = max(dot(N, L), 0.0);

    // Small normal-offset bias. The wagon depth map stores back faces (front-face
    // culling), so self-shadow acne is already prevented geometrically and the
    // offset can stay tiny -- keeping component-to-component shadows crisp. A faint
    // grazing term still guards against terrain shadows acne-ing on the body.
    vec3 sample_pos = v_view_pos + N * (0.02 + 0.05 * (1.0 - ndl));

    float shadow = sun_shadow(sample_pos, ndl);

    // True Lambert: each face's brightness tracks its own normal, so the flat
    // facets read crisply (faces turned away from the sun go dark, with a real
    // terminator). A solid ambient fill keeps shadowed faces from going black.
    vec3 ambient = u_wagon_color * 0.4;
    vec3 diffuse = u_wagon_color * ndl * shadow * 0.7;
    gl_FragColor = vec4(ambient + diffuse, 1.0);
}
