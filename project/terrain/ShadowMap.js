import { CGFshader, CGFcameraOrtho } from "../../lib/CGF.js";
import {
    TERRAIN_SHADOW_SIZE,
    TERRAIN_SHADOW_LOD_DEPTH,
    TERRAIN_SHADOW_BIAS_MIN,
    TERRAIN_SHADOW_BIAS_MAX,
    TERRAIN_NEAR_SHADOW_SIZE,
    TERRAIN_NEAR_SHADOW_RADIUS,
    TERRAIN_NEAR_SHADOW_BIAS_MIN,
    TERRAIN_NEAR_SHADOW_BIAS_MAX,
    TERRAIN_NEAR_SHADOW_SUN_FLOOR,
    TERRAIN_NEAR_SHADOW_BACK_HEADROOM,
    WAGON_SHADOW_SIZE,
    WAGON_SHADOW_RADIUS,
    WAGON_SHADOW_BIAS_MIN,
    WAGON_SHADOW_BIAS_MAX,
} from "./constants.js";

// Sun shadows for the terrain and the wagon, from three depth maps:
//
//  - terrain (whole): the whole terrain at a tight ortho fit and uniform LOD,
//    for the distant shadows the near map doesn't reach.
//  - terrain (near): same resolution over a small square that follows the wagon,
//    so terrain self-shadows are sharp near it. Where a fragment is inside it, it
//    overrides the whole-terrain map.
//  - wagon: small, very high-resolution, follows the wagon, holding the wagon's
//    own silhouette so it casts a crisp shadow.
//
// The sun tracks the day/night cycle, so all three maps are re-rendered every
// frame. A fragment is shadowed if any applicable map occludes the sun (the maps
// are combined with min). The same uniforms light the wagon body shader, so it
// receives terrain and self shadows too.
//
// Everything lives in scene-world space (Y up, after Scene's -90deg X rotation).
// The sun direction is pulled from the sky's day/night cycle each frame
// (SkySphere.sun_world_dir); the CGF Sun/Moon lights are otherwise ignored here.
export class ShadowMap {
    // Sun direction (scene-world, Y up, towards the sun) used before the sky's
    // day/night cycle takes over each frame in updateSun().
    static INITIAL_SUN_DIR = [0.5, 0.3, -0.8];

    // Moon direction (scene-world, towards the moon): the sun's antipode, used
    // before the sky's day/night cycle takes over each frame in updateSun().
    static INITIAL_MOON_DIR = [-0.5, -0.3, 0.8];

    // Each light is full down to the horizon and fades to zero over the 0 deg ->
    // -2 deg band, so it dies out just as it dips below the horizon rather than
    // leaking light from underneath. Stored as sin(elevation) to compare directly
    // against the normalized light direction's Y (= sin of its elevation).
    static LIGHT_CUTOFF_SIN = Math.sin((-2.0 * Math.PI) / 180.0); // off at/below -2 deg
    static LIGHT_FULL_SIN = 0.0;                                  // full at the horizon

    // Smooth 0->1 gate for a light at elevation asin(dir_y): 0 at/below the cutoff,
    // 1 at/above full, smoothstepped between so it can't pop on at the threshold.
    static horizonGate(dir_y) {
        const lo = ShadowMap.LIGHT_CUTOFF_SIN;
        const hi = ShadowMap.LIGHT_FULL_SIN;
        const t = Math.max(0, Math.min(1, (dir_y - lo) / (hi - lo)));
        return t * t * (3 - 2 * t);
    }

    constructor(scene) {
        this.scene = scene;
        this.gl = scene.gl;

        // Depth-only shader for both light passes.
        this.depth_shader = new CGFshader(this.gl, "terrain/shaders/depth.vert", "terrain/shaders/depth.frag");

        // --- Terrain map: whole terrain, re-rendered every frame ---
        this.terrain_size = TERRAIN_SHADOW_SIZE;
        this.terrain_lod_depth = TERRAIN_SHADOW_LOD_DEPTH;
        this.terrain_bias = [TERRAIN_SHADOW_BIAS_MIN, TERRAIN_SHADOW_BIAS_MAX];
        const tm = this.initMap(this.terrain_size);
        this.terrain_tex = tm.tex;
        this.terrain_fbo = tm.fbo;
        this.terrain_cam = new CGFcameraOrtho(-1, 1, -1, 1, 1, 10, [0, 0, 0], [0, 0, -1], [0, 1, 0]);
        this.terrain_frozen = mat4.create(); // world-space -> terrain light clip
        this.terrain_light_vp = mat4.create(); // eye-space -> terrain light clip (rebuilt per frame)

        // --- Near terrain map: follows the wagon, sharper self-shadows ---
        this.near_size = TERRAIN_NEAR_SHADOW_SIZE;
        this.near_radius = TERRAIN_NEAR_SHADOW_RADIUS;
        this.near_bias = [TERRAIN_NEAR_SHADOW_BIAS_MIN, TERRAIN_NEAR_SHADOW_BIAS_MAX];
        const nm = this.initMap(this.near_size);
        this.near_tex = nm.tex;
        this.near_fbo = nm.fbo;
        this.near_cam = new CGFcameraOrtho(-1, 1, -1, 1, 1, 10, [0, 0, 0], [0, 0, -1], [0, 1, 0]);
        this.near_frozen = mat4.create();
        this.near_light_vp = mat4.create();
        this.near_bias_scale = 1; // world-bias compensation as the near reach deepens (renderTerrainNear)

        // --- Wagon map: small, crisp, follows the wagon ---
        this.wagon_size = WAGON_SHADOW_SIZE;
        this.wagon_radius = WAGON_SHADOW_RADIUS;
        this.wagon_bias = [WAGON_SHADOW_BIAS_MIN, WAGON_SHADOW_BIAS_MAX];
        const wm = this.initMap(this.wagon_size);
        this.wagon_tex = wm.tex;
        this.wagon_fbo = wm.fbo;
        this.wagon_cam = new CGFcameraOrtho(-1, 1, -1, 1, 1, 10, [0, 0, 0], [0, 0, -1], [0, 1, 0]);
        this.wagon_frozen = mat4.create();
        this.wagon_light_vp = mat4.create();

        // Normalized sun and moon directions (towards each light), refreshed from
        // the sky's day/night cycle every frame and used to light the surfaces.
        this.sun_dir = vec3.normalize(vec3.create(), vec3.fromValues(...ShadowMap.INITIAL_SUN_DIR));
        this.moon_dir = vec3.normalize(vec3.create(), vec3.fromValues(...ShadowMap.INITIAL_MOON_DIR));
        this.world_up = vec3.fromValues(0, 1, 0);

        // The single set of maps casts from whichever light is above the horizon.
        // Sun and moon are antipodal and never both lit, so the sun casts by day and
        // the moon at night. cast_dir is that light's direction, cast_look its -D.
        this.cast_dir = vec3.clone(this.sun_dir);
        this.cast_look = vec3.negate(vec3.create(), this.cast_dir);

        // The whole-terrain bias is in normalized light-clip depth, so its real
        // (world) size is bias * the light frustum's depth range. That range is
        // the terrain AABB projected onto the sun direction, which collapses when
        // the sun is overhead -- under-biasing the map's large texels and
        // speckling distant ground with acne. We hold the world-space bias
        // constant by scaling the band each frame (renderTerrain) against the
        // range at the reference angle the band was tuned at (INITIAL_SUN_DIR).
        const ref = vec3.normalize(vec3.create(), vec3.fromValues(...ShadowMap.INITIAL_SUN_DIR));
        this.terrain_bias_ref = [Math.abs(ref[0]), Math.abs(ref[1]), Math.abs(ref[2])];
        this.terrain_bias_scale = 1;

        // eye-space -> world-space (inverse of the main camera view), recomputed
        // per frame so the shaders can map their eye-space fragments into the maps
        // without a new vertex attribute.
        this.inv_view = mat4.create();
        this.sun_eye = vec3.create(); // sun direction in eye space, for the wagon body shader
        this.moon_eye = vec3.create(); // moon direction in eye space, for the night fill

        // Per-light brightness (0..1), gated by elevation so each cuts off near the
        // horizon. Recomputed each frame in updateSun() and uploaded to the shaders.
        this.sun_intensity = 1;
        this.moon_intensity = 0;

        // Uniform locations cached per shader program (the terrain and wagon body
        // shaders share these uniforms but have different locations).
        this._loc_by_prog = new Map();
        this._p = vec3.create(); // scratch for point transforms
    }

    // Allocate a depth texture + depth-only framebuffer. WebGL2 gives sampleable
    // depth textures with no extensions; NEAREST filtering (depth textures can't
    // linear-filter without a compare sampler) is fine -- the main pass does PCF.
    initMap(size) {
        const gl = this.gl;
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, size, size, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        // Outside the map clamps to the border; the main pass treats out-of-range
        // and far (uncast) lookups as "lit".
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        const fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, tex, 0);
        gl.drawBuffers([gl.NONE]); // depth-only: no colour buffer
        gl.readBuffer(gl.NONE);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.bindTexture(gl.TEXTURE_2D, null);
        return { tex, fbo };
    }

    // =====================================================
    // Depth passes
    // =====================================================

    // Refresh the sun for this frame: pull its scene-world direction from the
    // sky's day/night cycle, rebuild the light's look direction, and recompute
    // the eye-space sun direction (for the body shaders) and the eye->world
    // matrix. Runs every frame regardless of whether the maps are rendered, since
    // every surface shader lights from u_sun_eye_dir.
    updateSun() {
        const sky = this.scene.sky_sphere;
        if (sky && sky.sun_world_dir) {
            this.sun_dir[0] = sky.sun_world_dir[0];
            this.sun_dir[1] = sky.sun_world_dir[1];
            this.sun_dir[2] = sky.sun_world_dir[2];
            vec3.normalize(this.sun_dir, this.sun_dir);
        }
        if (sky && sky.moon_world_dir) {
            this.moon_dir[0] = sky.moon_world_dir[0];
            this.moon_dir[1] = sky.moon_world_dir[1];
            this.moon_dir[2] = sky.moon_world_dir[2];
            vec3.normalize(this.moon_dir, this.moon_dir);
        }
        // Cast from whichever light is higher (the one above the horizon); the maps
        // then hold the sun's shadows by day and the moon's at night.
        const caster = this.sun_dir[1] >= this.moon_dir[1] ? this.sun_dir : this.moon_dir;
        vec3.copy(this.cast_dir, caster);
        vec3.negate(this.cast_look, this.cast_dir);

        // eye -> world (undoes the main camera view) and the sun/moon directions in
        // eye space; all change as the camera moves and as they arc across the sky.
        const view = this.scene.camera.getViewMatrix();
        mat4.invert(this.inv_view, view);
        this.transformDir(view, this.sun_dir[0], this.sun_dir[1], this.sun_dir[2], this.sun_eye);
        vec3.normalize(this.sun_eye, this.sun_eye);
        this.transformDir(view, this.moon_dir[0], this.moon_dir[1], this.moon_dir[2], this.moon_eye);
        vec3.normalize(this.moon_eye, this.moon_eye);

        // Fade each light out over the 0 -> -2 deg band (dir is normalized, so its Y
        // is sin of the elevation). Multiplied into the direct terms in the shaders.
        this.sun_intensity = ShadowMap.horizonGate(this.sun_dir[1]);
        this.moon_intensity = ShadowMap.horizonGate(this.moon_dir[1]);
    }

    // Re-render all three depth maps for the sun's current position and rebuild
    // their eye-space matrices. The sun moves with the day/night cycle, so every
    // map is redrawn every frame. Self-contained: saves and restores the scene
    // camera, matrix stack, framebuffer and viewport so the caller's main pass
    // continues unaffected. Assumes updateSun() ran first and the current
    // activeMatrix is the main view.
    render(terrain) {
        const scene = this.scene;
        const gl = this.gl;
        const wagon = scene.wagon;

        const real_cam = scene.camera;
        scene.pushMatrix(); // save the main view·rotation matrix once
        scene.setActiveShader(this.depth_shader);

        this.renderTerrain(terrain);
        if (wagon) {
            this.renderTerrainNear(terrain, wagon);
            this.renderWagon(wagon);
        }

        scene.camera = real_cam;
        scene.popMatrix();
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

        // eye-space -> light clip = frozen(world->light) · (eye->world).
        mat4.multiply(this.terrain_light_vp, this.terrain_frozen, this.inv_view);
        mat4.multiply(this.near_light_vp, this.near_frozen, this.inv_view);
        mat4.multiply(this.wagon_light_vp, this.wagon_frozen, this.inv_view);
    }

    // Render the whole terrain into the terrain map. The light frustum is
    // fitted tightly to the terrain's world AABB so the fixed-resolution map packs
    // as many texels per metre as possible, and the terrain is drawn at a uniform
    // LOD (not the wagon-centred one) so detail is even across the whole map.
    renderTerrain(terrain) {
        const scene = this.scene;
        const gl = this.gl;

        const h = terrain.half_extent;
        const y_min = -100;
        const y_max = terrain.terrain_max_height + 100;
        const cam = this.terrain_cam;

        // Look along the sun from a point well above the terrain centre; the exact
        // distance doesn't matter for an ortho fit, only the bounds do.
        const center = [0, (y_min + y_max) / 2, 0];
        const dist = 2 * h + (y_max - y_min);
        cam.setPosition([center[0] + this.cast_dir[0] * dist, center[1] + this.cast_dir[1] * dist, center[2] + this.cast_dir[2] * dist]);
        cam.setTarget(center);
        cam._up = this.world_up;

        // Tight ortho: project the 8 AABB corners into the light view and take
        // their extents. (right, up) -> left/right/bottom/top; depth -> near/far.
        const view = cam.getViewMatrix();
        let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity, minz = Infinity, maxz = -Infinity;
        for (let i = 0; i < 8; i++) {
            const x = i & 1 ? h : -h;
            const y = i & 2 ? y_max : y_min;
            const z = i & 4 ? h : -h;
            this.transformPoint(view, x, y, z, this._p);
            minx = Math.min(minx, this._p[0]); maxx = Math.max(maxx, this._p[0]);
            miny = Math.min(miny, this._p[1]); maxy = Math.max(maxy, this._p[1]);
            minz = Math.min(minz, this._p[2]); maxz = Math.max(maxz, this._p[2]);
        }
        cam.left = minx; cam.right = maxx;
        cam.bottom = miny; cam.top = maxy;
        // View looks down -z, so closer points have larger (less negative) z.
        cam.near = Math.max(1, -maxz - 1);
        cam.far = -minz + 1;

        // Hold the depth bias constant in world units as the sun arcs: scale the
        // band by how much this frame's depth range has shrunk relative to the
        // reference angle (the AABB extent projected onto each sun direction).
        const range = cam.far - cam.near;
        const a = this.terrain_bias_ref;
        const ref_range = 2 * h * (a[0] + a[2]) + (y_max - y_min) * a[1];
        this.terrain_bias_scale = range > 0 ? ref_range / range : 1;

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.terrain_fbo);
        gl.viewport(0, 0, this.terrain_size, this.terrain_size);
        gl.clear(gl.DEPTH_BUFFER_BIT);

        scene.camera = cam;
        scene.updateProjectionMatrix(); // uPMatrix = terrain ortho
        scene.loadIdentity();
        scene.applyViewMatrix(); // activeMatrix = light view

        // Cast from both sides of the heightfield: the terrain is a single sheet,
        // so back-face culling would record only its sun-facing side. Once the sun
        // arcs below the horizon its triangles turn away from the light and would
        // be culled, leaving the map empty so the sun leaks up through the ground
        // and lights the wagon from underneath. Drawing the underside too keeps the
        // terrain occluding the sun no matter which side it is on.
        gl.disable(gl.CULL_FACE);
        scene.pushMatrix();
        scene.rotate(-Math.PI / 2, 1, 0, 0); // into terrain-model frame, matching the main draw
        terrain.drawQuadDepth(-h, h, terrain.effective_size, 0, null, this.terrain_lod_depth);
        scene.popMatrix();
        gl.enable(gl.CULL_FACE);

        // World-space -> terrain light clip (proj · view).
        mat4.multiply(this.terrain_frozen, cam.getProjectionMatrix(this.terrain_size, this.terrain_size), view);
    }

    // Centre the near terrain map on the wagon and render the terrain into it at
    // the wagon-centred LOD (so it reuses the main pass's fine tiles), culled to
    // the map's footprint. The centre is texel-snapped to avoid shimmer.
    renderTerrainNear(terrain, wagon) {
        const scene = this.scene;
        const gl = this.gl;
        const r = this.near_radius;
        const cam = this.near_cam;

        // Sit the frustum up-sun of the wagon far enough that distant casters --
        // whose long, low-sun shadows still fall on the footprint -- are in front
        // of the light camera, not clipped behind its near plane. The reach grows
        // like 1/sin(sun elevation) as the sun drops, but is capped at the terrain
        // size + headroom (nothing on the terrain casts from farther) so it can't
        // diverge at the horizon. fitFollow keeps the perpendicular footprint at
        // +/-r regardless of the reach.
        const reach = Math.min(
            r / Math.max(this.cast_dir[1], TERRAIN_NEAR_SHADOW_SUN_FLOOR) + r,
            terrain.effective_size + TERRAIN_NEAR_SHADOW_BACK_HEADROOM,
        );
        const center = [wagon.position_x, wagon.position_y, wagon.position_z];
        this.fitFollow(cam, this.near_size, r, center, reach);

        // Deepening the frustum stretches the normalized depth band, so scale the
        // bias to hold its world size at the value tuned for the base reach (r).
        this.near_bias_scale = r / reach;

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.near_fbo);
        gl.viewport(0, 0, this.near_size, this.near_size);
        gl.clear(gl.DEPTH_BUFFER_BIT);

        scene.camera = cam;
        scene.updateProjectionMatrix();
        scene.loadIdentity();
        scene.applyViewMatrix();

        // Double-sided, like the whole-terrain map: the sheet must occlude the sun
        // from below too, or it leaks up through the ground at night (see renderTerrain).
        gl.disable(gl.CULL_FACE);
        scene.pushMatrix();
        scene.rotate(-Math.PI / 2, 1, 0, 0); // into terrain-model frame
        terrain.drawQuadDepth(-terrain.half_extent, terrain.half_extent, terrain.effective_size, 0, this.nearCullBox(terrain, reach), null);
        scene.popMatrix();
        gl.enable(gl.CULL_FACE);

        mat4.multiply(this.near_frozen, cam.getProjectionMatrix(this.near_size, this.near_size), cam.getViewMatrix());
    }

    // Model-space AABB of the near map's ground footprint, to cull the depth walk.
    // `reach` is the frustum's up-sun extent (renderTerrainNear); the box is that
    // wide each way so every caster the frustum can contain still gets drawn into it.
    nearCullBox(terrain, reach) {
        const half = reach;
        const wmx = terrain._wmx;
        const wmy = terrain._wmy;
        return { minx: wmx - half, maxx: wmx + half, miny: wmy - half, maxy: wmy + half };
    }

    // Aim an ortho light camera at a square of half-extent r centred on `center`,
    // looking along the active light. The centre is snapped to the map's texel grid
    // (along the light's right/up axes) so the shadow doesn't shimmer as it follows.
    fitFollow(cam, size, r, center, back) {
        const right = vec3.normalize(vec3.create(), vec3.cross(vec3.create(), this.world_up, this.cast_look));
        const up = vec3.normalize(vec3.create(), vec3.cross(vec3.create(), this.cast_look, right));

        const wpt = (2 * r) / size; // world units per texel
        let ar = center[0] * right[0] + center[1] * right[1] + center[2] * right[2];
        let au = center[0] * up[0] + center[1] * up[1] + center[2] * up[2];
        const ad = center[0] * this.cast_look[0] + center[1] * this.cast_look[1] + center[2] * this.cast_look[2];
        ar = Math.round(ar / wpt) * wpt;
        au = Math.round(au / wpt) * wpt;
        const c = [
            right[0] * ar + up[0] * au + this.cast_look[0] * ad,
            right[1] * ar + up[1] * au + this.cast_look[1] * ad,
            right[2] * ar + up[2] * au + this.cast_look[2] * ad,
        ];

        cam.left = -r; cam.right = r; cam.bottom = -r; cam.top = r;
        cam.near = 1; cam.far = 2 * back;
        cam.setPosition([c[0] + this.cast_dir[0] * back, c[1] + this.cast_dir[1] * back, c[2] + this.cast_dir[2] * back]);
        cam.setTarget(c);
        cam._up = this.world_up;
    }

    // Render just the wagon into its small map, centred on the wagon. The centre
    // is snapped to the map's texel grid so the crisp shadow doesn't shimmer as
    // the wagon drives.
    renderWagon(wagon) {
        const scene = this.scene;
        const gl = this.gl;
        const cam = this.wagon_cam;

        // Centre on the wagon body; tight depth range (the wagon is only ~10 units
        // tall) keeps the depth texture's precision over it.
        const center = [wagon.position_x, wagon.position_y + 2.5, wagon.position_z];
        this.fitFollow(cam, this.wagon_size, this.wagon_radius, center, this.wagon_radius);

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.wagon_fbo);
        gl.viewport(0, 0, this.wagon_size, this.wagon_size);
        gl.clear(gl.DEPTH_BUFFER_BIT);

        scene.camera = cam;
        scene.updateProjectionMatrix();
        scene.loadIdentity();
        scene.applyViewMatrix();

        // The wagon is drawn in world space (no -90 rotation, unlike the terrain).
        // _depth_pass tells Wagon.display to skip its lit body shader and just emit
        // geometry into the depth map under the active depth shader.
        //
        // Cull FRONT faces here (second-depth shadow mapping): the map stores each
        // solid component's BACK face, so a lit front face is always nearer the sun
        // than the stored depth and can't self-shadow itself -- the body's
        // component-to-component shadows come out crisp with almost no bias, instead
        // of needing a heavy normal offset that smears them. The silhouette (hence
        // the floor shadow) is unchanged. Restore back-face culling afterwards.
        gl.cullFace(gl.FRONT);
        wagon._depth_pass = true;
        wagon.display();
        wagon._depth_pass = false;
        gl.cullFace(gl.BACK);

        mat4.multiply(this.wagon_frozen, cam.getProjectionMatrix(this.wagon_size, this.wagon_size), cam.getViewMatrix());
    }

    // m (column-major mat4) applied to point (x, y, z) -> out.
    transformPoint(m, x, y, z, out) {
        out[0] = m[0] * x + m[4] * y + m[8] * z + m[12];
        out[1] = m[1] * x + m[5] * y + m[9] * z + m[13];
        out[2] = m[2] * x + m[6] * y + m[10] * z + m[14];
    }

    // m applied to direction (x, y, z) -> out (no translation).
    transformDir(m, x, y, z, out) {
        out[0] = m[0] * x + m[4] * y + m[8] * z;
        out[1] = m[1] * x + m[5] * y + m[9] * z;
        out[2] = m[2] * x + m[6] * y + m[10] * z;
    }

    // =====================================================
    // Main-pass uniforms
    // =====================================================

    loc(name) {
        let m = this._loc_by_prog.get(this._prog);
        if (!m) {
            m = {};
            this._loc_by_prog.set(this._prog, m);
        }
        let l = m[name];
        if (l === undefined) {
            l = this.gl.getUniformLocation(this._prog, name);
            if (l !== null) m[name] = l; // cache only resolved locations
        }
        return l;
    }

    // Bind the three depth maps (units 8, 9, 10) and upload their matrices and
    // tuning to the given (already active) shader. Shared by the terrain shader
    // and the wagon body shader -- both declare these uniforms (the wagon shader
    // also reads u_sun_eye_dir for its lighting; the terrain shader ignores it).
    // Raw GL, so the samplers/matrices set cleanly.
    applyUniforms(shader) {
        const gl = this.gl;
        this._prog = shader.program;

        gl.activeTexture(gl.TEXTURE0 + 8);
        gl.bindTexture(gl.TEXTURE_2D, this.terrain_tex);
        gl.uniform1i(this.loc("u_terrain_shadow_map"), 8);
        gl.activeTexture(gl.TEXTURE0 + 9);
        gl.bindTexture(gl.TEXTURE_2D, this.wagon_tex);
        gl.uniform1i(this.loc("u_wagon_shadow_map"), 9);
        gl.activeTexture(gl.TEXTURE0 + 10);
        gl.bindTexture(gl.TEXTURE_2D, this.near_tex);
        gl.uniform1i(this.loc("u_terrain_near_shadow_map"), 10);

        gl.uniformMatrix4fv(this.loc("u_terrain_light_vp"), false, this.terrain_light_vp);
        gl.uniformMatrix4fv(this.loc("u_terrain_near_light_vp"), false, this.near_light_vp);
        gl.uniformMatrix4fv(this.loc("u_wagon_light_vp"), false, this.wagon_light_vp);
        gl.uniform1f(this.loc("u_terrain_shadow_texel"), 1 / this.terrain_size);
        gl.uniform1f(this.loc("u_terrain_near_shadow_texel"), 1 / this.near_size);
        gl.uniform1f(this.loc("u_wagon_shadow_texel"), 1 / this.wagon_size);
        gl.uniform2f(this.loc("u_terrain_shadow_bias"),
            this.terrain_bias[0] * this.terrain_bias_scale, this.terrain_bias[1] * this.terrain_bias_scale);
        gl.uniform2f(this.loc("u_terrain_near_shadow_bias"),
            this.near_bias[0] * this.near_bias_scale, this.near_bias[1] * this.near_bias_scale);
        gl.uniform2f(this.loc("u_wagon_shadow_bias"), this.wagon_bias[0], this.wagon_bias[1]);
        gl.uniform3f(this.loc("u_sun_eye_dir"), this.sun_eye[0], this.sun_eye[1], this.sun_eye[2]);
        gl.uniform3f(this.loc("u_moon_eye_dir"), this.moon_eye[0], this.moon_eye[1], this.moon_eye[2]);
        gl.uniform1f(this.loc("u_sun_intensity"), this.sun_intensity);
        gl.uniform1f(this.loc("u_moon_intensity"), this.moon_intensity);
        gl.uniform1i(this.loc("u_shadow_enabled"), 1);
        gl.activeTexture(gl.TEXTURE0);
    }

    // Tell a shader to skip the shadow lookup entirely (but still pass the sun
    // and moon directions so the surfaces still light).
    disable(shader) {
        const gl = this.gl;
        this._prog = shader.program;
        gl.uniform3f(this.loc("u_sun_eye_dir"), this.sun_eye[0], this.sun_eye[1], this.sun_eye[2]);
        gl.uniform3f(this.loc("u_moon_eye_dir"), this.moon_eye[0], this.moon_eye[1], this.moon_eye[2]);
        gl.uniform1f(this.loc("u_sun_intensity"), this.sun_intensity);
        gl.uniform1f(this.loc("u_moon_intensity"), this.moon_intensity);
        gl.uniform1i(this.loc("u_shadow_enabled"), 0);
    }
}
