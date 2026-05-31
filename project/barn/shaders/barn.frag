#ifdef GL_ES
precision highp float;
#endif

varying vec2 vTextureCoord;
varying vec3 vObjNormal;  // object-space normal, for the door/window mask test
varying vec3 v_normal;    // eye-space normal, for the sun/moon lighting
varying vec3 v_view_pos;  // eye-space position, for the shadow-map lookups
varying vec3 vBarnPos;    // position in unified barn-local space, for fake AO

uniform sampler2D uSampler;  // wood (unit 0)
uniform sampler2D uSampler2; // door (unit 1)
uniform sampler2D uSampler3; // window (unit 2)
uniform sampler2D uSampler4; // mask (unit 3)
uniform vec3 uWoodTint;      // per-part tint multiplied into the wood
uniform float uUseMask;      // >0.5 swaps in the door/window where the mask marks it
uniform float uAOStrength;   // 1 on the walls (ground-contact AO), 0 elsewhere

uniform vec3 u_sun_eye_dir;     // sun direction in eye space (the abstract sun)
uniform vec3 u_moon_eye_dir;    // moon direction in eye space (cool night fill)
uniform float u_sun_intensity;  // 0..1, faded to 0 over the 0 -> -2 deg horizon band
uniform float u_moon_intensity; // 0..1, faded to 0 over the 0 -> -2 deg horizon band

const vec3 MOON_COLOR = vec3(0.12, 0.16, 0.26); // very dim, dark-cool moonlight

// --- Sun shadows (same maps and uniforms as the terrain + wagon shaders) -----
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

// Terrain (+ barn) shadow: prefer the sharp near map, fall back to the whole map.
float terrain_shadow(vec3 view_pos, float ndl) {
    float ns = u_terrain_near_shadow_on ? sample_shadow(u_terrain_near_shadow_map, u_terrain_near_light_vp, view_pos, slope_bias(u_terrain_near_shadow_bias, ndl), u_terrain_near_shadow_texel) : -1.0;
    if(ns >= 0.0)
        return ns;
    float fs = u_terrain_shadow_on ? sample_shadow(u_terrain_shadow_map, u_terrain_light_vp, view_pos, slope_bias(u_terrain_shadow_bias, ndl), u_terrain_shadow_texel) : -1.0;
    return fs < 0.0 ? 1.0 : fs;
}

// Sun visibility: the darker of the terrain/barn shadow and the wagon's own map,
// so the barn is shadowed by the terrain, by itself (it casts into the terrain
// maps), and by the wagon as it drives past.
float sun_shadow(vec3 view_pos, float ndl) {
    if(!u_shadow_enabled)
        return 1.0;
    float terrain_s = terrain_shadow(view_pos, ndl);
    float wagon_s = u_wagon_shadow_on ? sample_shadow(u_wagon_shadow_map, u_wagon_light_vp, view_pos, slope_bias(u_wagon_shadow_bias, ndl), u_wagon_shadow_texel) : -1.0;
    return min(terrain_s, wagon_s < 0.0 ? 1.0 : wagon_s);
}

// Cheap, geometry-aware ambient occlusion. The one crease the eye reliably reads
// on the barn is the ground contact at the foot of the walls (barn y starts at
// 0.2), so we just darken a band there and leave the roof/gable untouched. No
// extra passes -- just the interpolated barn position.
float barn_ao(vec3 p) {
    // Ground contact: the bottom ~6 units of the walls fall toward the floor.
    return mix(0.4, 1.0, smoothstep(0.2, 6.0, p.y));
}

void main() {
    // ---- Base colour: tinted wood, with the door/window swapped in by the mask.
    // The mask test keys off the object-space normal (which face this is), so it
    // stays correct however the barn is transformed in the world.
    vec2 reducedvtex = vec2(vTextureCoord.x / 4.0, vTextureCoord.y);
    vec2 wrappedvtex = vec2(fract(vTextureCoord.x), vTextureCoord.y);

    vec3 base = texture2D(uSampler, wrappedvtex).rgb * uWoodTint;

    if(uUseMask > 0.5) {
        vec4 mask = texture2D(uSampler4, reducedvtex);
        if(mask.g > 0.8 && abs(vObjNormal.z) > 0.5)
            base = texture2D(uSampler2, reducedvtex).rgb;
        if(mask.b > 0.8 && abs(vObjNormal.y) == 0.0)
            base = texture2D(uSampler3, reducedvtex).rgb;
        if(mask.r > 0.8 && mask.g > 0.8 && mask.b > 0.8)
            base = vec3(1.0);
    }

    // ---- Lighting: true Lambert from the abstract sun, shadowed by all maps.
    vec3 N = normalize(v_normal);
    vec3 L = normalize(u_sun_eye_dir);
    vec3 Lm = normalize(u_moon_eye_dir);
    float ndl = max(dot(N, L), 0.0);
    float moon_ndl = max(dot(N, Lm), 0.0);

    // The maps cast from whichever light is up; bias against that caster's angle.
    vec3 cast_L = u_sun_intensity >= u_moon_intensity ? L : Lm;
    float ndl_cast = max(dot(N, cast_L), 0.0);

    // Normal-offset bias. The barn casts its back faces into the terrain maps
    // (front-face culled, second-depth), so self-shadow acne is mostly geometric;
    // a small grazing offset keeps the large flat walls clean where the coarser
    // terrain map's texels would otherwise speckle them.
    vec3 sample_pos = v_view_pos + N * (0.06 + 0.25 * (1.0 - ndl_cast));

    float shadow = sun_shadow(sample_pos, ndl_cast);

    // Solid ambient fill keeps shadowed faces off black; sun + cool moon ride on
    // top, each gated by its own N.L and faded out below the horizon. Fake AO mostly
    // bites the ambient term (where occlusion belongs, and where the sun is already
    // shadow-mapped); a faint share also dims the direct terms so the ground contact
    // still reads a touch in full sunlight rather than vanishing.
    float ao = mix(1.0, barn_ao(vBarnPos), uAOStrength);
    float ao_direct = mix(1.0, ao, 0.3);
    vec3 ambient = base * 0.3 * ao;
    vec3 diffuse = base * ndl * shadow * 0.7 * u_sun_intensity * ao_direct;
    vec3 moon = base * MOON_COLOR * moon_ndl * shadow * 0.7 * u_moon_intensity * ao_direct;

    gl_FragColor = vec4(ambient + diffuse + moon, 1.0);
}
