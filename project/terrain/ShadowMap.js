import { CGFshader, CGFcameraOrtho } from "../../lib/CGF.js";
import {
    TERRAIN_SHADOW_SIZE,
    TERRAIN_SHADOW_LOD_DEPTH,
    TERRAIN_SHADOW_BIAS_MIN,
    TERRAIN_SHADOW_BIAS_MAX,
    TERRAIN_NEAR_SHADOW_SIZE,
    TERRAIN_NEAR_SHADOW_RADIUS,
    TERRAIN_NEAR_SHADOW_RECENTER,
    TERRAIN_NEAR_SHADOW_BIAS_MIN,
    TERRAIN_NEAR_SHADOW_BIAS_MAX,
    WAGON_SHADOW_SIZE,
    WAGON_SHADOW_RADIUS,
    WAGON_SHADOW_BIAS_MIN,
    WAGON_SHADOW_BIAS_MAX,
} from "./constants.js";

// Sun shadows for the terrain and the wagon, from three depth maps:
//
//  - terrain (whole): baked exactly once over the whole terrain (tight ortho
//    fit, uniform LOD), never re-rendered -- the terrain and sun are static.
//  - terrain (near): same resolution over a small square that follows the wagon,
//    re-centred only when the wagon drifts far enough, so terrain self-shadows
//    are sharp near the wagon. Where a fragment is inside it, it overrides the
//    whole-terrain map.
//  - wagon: small, very high-resolution, follows the wagon (re-rendered every
//    frame), holding the wagon's own silhouette so it casts a crisp shadow.
//
// A fragment is shadowed if any applicable map occludes the sun (the maps are
// combined with min). The same uniforms light the wagon body shader, so it
// receives terrain and self shadows too.
//
// Everything lives in scene-world space (Y up, after Scene's -90deg X rotation).
// The sun direction is the terrain shader's abstract SUN_WORLD_DIR rotated into
// that frame; the CGF Sun/Moon lights are deliberately ignored.
export class ShadowMap {
    // SUN_WORLD_DIR in terrain.frag is (0.5, 0.8, 0.3) in terrain-model space.
    // Scene draws the terrain under rotate(-90deg, X), mapping model (x,y,z) ->
    // world (x, z, -y); so the sun points this way in scene-world (Y up). This is
    // the direction *towards* the sun (the shader's L); light travels along -D.
    static SUN_WORLD_DIR = [0.5, 0.3, -0.8];

    constructor(scene) {
        this.scene = scene;
        this.gl = scene.gl;

        // Depth-only shader for both light passes.
        this.depth_shader = new CGFshader(this.gl, "terrain/shaders/depth.vert", "terrain/shaders/depth.frag");

        // --- Terrain map: baked once, static ---
        this.terrain_size = TERRAIN_SHADOW_SIZE;
        this.terrain_lod_depth = TERRAIN_SHADOW_LOD_DEPTH;
        this.terrain_bias = [TERRAIN_SHADOW_BIAS_MIN, TERRAIN_SHADOW_BIAS_MAX];
        const tm = this.initMap(this.terrain_size);
        this.terrain_tex = tm.tex;
        this.terrain_fbo = tm.fbo;
        this.terrain_cam = new CGFcameraOrtho(-1, 1, -1, 1, 1, 10, [0, 0, 0], [0, 0, -1], [0, 1, 0]);
        this.terrain_frozen = mat4.create(); // world-space -> terrain light clip, as baked
        this.terrain_light_vp = mat4.create(); // eye-space -> terrain light clip (rebuilt per frame)
        this.terrain_rendered = false;

        // --- Near terrain map: follows the wagon, sharper self-shadows ---
        this.near_size = TERRAIN_NEAR_SHADOW_SIZE;
        this.near_radius = TERRAIN_NEAR_SHADOW_RADIUS;
        this.near_recenter = TERRAIN_NEAR_SHADOW_RECENTER;
        this.near_bias = [TERRAIN_NEAR_SHADOW_BIAS_MIN, TERRAIN_NEAR_SHADOW_BIAS_MAX];
        const nm = this.initMap(this.near_size);
        this.near_tex = nm.tex;
        this.near_fbo = nm.fbo;
        this.near_cam = new CGFcameraOrtho(-1, 1, -1, 1, 1, 10, [0, 0, 0], [0, 0, -1], [0, 1, 0]);
        this.near_frozen = mat4.create();
        this.near_light_vp = mat4.create();
        this.near_rendered = false;
        this.near_center = [0, 0]; // wagon world (x, z) at last re-centre

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
        this.wagon_rendered = false;

        // Normalized sun direction (towards the sun) and the light's look
        // direction (-D), reused every frame.
        this.sun_dir = vec3.normalize(vec3.create(), vec3.fromValues(...ShadowMap.SUN_WORLD_DIR));
        this.look_dir = vec3.negate(vec3.create(), this.sun_dir);
        this.world_up = vec3.fromValues(0, 1, 0);

        // eye-space -> world-space (inverse of the main camera view), recomputed
        // per frame so the shaders can map their eye-space fragments into the maps
        // without a new vertex attribute.
        this.inv_view = mat4.create();
        this.sun_eye = vec3.create(); // sun direction in eye space, for the wagon body shader

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

    // Force the terrain map to re-bake (e.g. after the terrain is regenerated).
    invalidateTerrain() {
        this.terrain_rendered = false;
    }

    // =====================================================
    // Depth passes
    // =====================================================

    // Bake the terrain map if needed and refresh the wagon map if it moved, then
    // rebuild both eye-space matrices for this frame. Self-contained: saves and
    // restores the scene camera, matrix stack, framebuffer and viewport so the
    // caller's main pass continues unaffected. Assumes the caller's current
    // activeMatrix is the main view.
    render(terrain) {
        const scene = this.scene;
        const gl = this.gl;

        // eye -> world for this frame (undoes the main camera view), and the sun
        // direction in eye space (for the wagon body shader). Both change every
        // frame as the camera moves even when nothing re-renders.
        const view = scene.camera.getViewMatrix();
        mat4.invert(this.inv_view, view);
        this.transformDir(view, this.sun_dir[0], this.sun_dir[1], this.sun_dir[2], this.sun_eye);
        vec3.normalize(this.sun_eye, this.sun_eye);

        const wagon = scene.wagon;
        const need_terrain = !this.terrain_rendered;
        const need_near = wagon && this.nearStale(wagon);
        // The wagon is low-poly, so its small map is re-rendered every frame.
        const need_wagon = !!wagon;

        if (need_terrain || need_near || need_wagon) {
            const real_cam = scene.camera;
            scene.pushMatrix(); // save the main view·rotation matrix once
            scene.setActiveShader(this.depth_shader);

            if (need_terrain) this.bakeTerrain(terrain);
            if (need_near) this.renderTerrainNear(terrain, wagon);
            if (need_wagon) this.renderWagon(wagon);

            scene.camera = real_cam;
            scene.popMatrix();
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        }

        // Per frame: eye-space -> light clip = frozen(world->light) · (eye->world).
        // Decoupled from the depth renders so the camera moves without forcing one.
        mat4.multiply(this.terrain_light_vp, this.terrain_frozen, this.inv_view);
        mat4.multiply(this.near_light_vp, this.near_frozen, this.inv_view);
        mat4.multiply(this.wagon_light_vp, this.wagon_frozen, this.inv_view);
    }

    // Has the wagon drifted far enough from the near map's centre to re-centre it?
    nearStale(wagon) {
        if (!this.near_rendered) return true;
        const dx = wagon.position_x - this.near_center[0];
        const dz = wagon.position_z - this.near_center[1];
        return dx * dx + dz * dz > this.near_recenter * this.near_recenter;
    }

    // Bake the whole terrain into the terrain map, once. The light frustum is
    // fitted tightly to the terrain's world AABB so the fixed-resolution map packs
    // as many texels per metre as possible, and the terrain is drawn at a uniform
    // LOD (not the wagon-centred one) so detail is even across the whole map.
    bakeTerrain(terrain) {
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
        cam.setPosition([center[0] + this.sun_dir[0] * dist, center[1] + this.sun_dir[1] * dist, center[2] + this.sun_dir[2] * dist]);
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

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.terrain_fbo);
        gl.viewport(0, 0, this.terrain_size, this.terrain_size);
        gl.clear(gl.DEPTH_BUFFER_BIT);

        scene.camera = cam;
        scene.updateProjectionMatrix(); // uPMatrix = terrain ortho
        scene.loadIdentity();
        scene.applyViewMatrix(); // activeMatrix = light view

        scene.pushMatrix();
        scene.rotate(-Math.PI / 2, 1, 0, 0); // into terrain-model frame, matching the main draw
        terrain.drawQuadDepth(-h, h, terrain.effective_size, 0, null, this.terrain_lod_depth);
        scene.popMatrix();

        // Freeze world-space -> terrain light clip (proj · view).
        mat4.multiply(this.terrain_frozen, cam.getProjectionMatrix(this.terrain_size, this.terrain_size), view);
        this.terrain_rendered = true;
    }

    // Re-centre the near terrain map on the wagon and re-render the terrain into
    // it at the wagon-centred LOD (so it reuses the main pass's fine tiles),
    // culled to the map's footprint. The centre is texel-snapped to avoid shimmer.
    renderTerrainNear(terrain, wagon) {
        const scene = this.scene;
        const gl = this.gl;
        const r = this.near_radius;
        const cam = this.near_cam;

        // Depth range tied to the map radius (not the global terrain height), so
        // the bias stays small and the near self-shadows stay sharp. This covers
        // ~r of vertical relief around the wagon either way -- ample for the
        // drivable ground it follows; taller distant terrain is the far map's job.
        const center = [wagon.position_x, wagon.position_y, wagon.position_z];
        this.fitFollow(cam, this.near_size, r, center, r);

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.near_fbo);
        gl.viewport(0, 0, this.near_size, this.near_size);
        gl.clear(gl.DEPTH_BUFFER_BIT);

        scene.camera = cam;
        scene.updateProjectionMatrix();
        scene.loadIdentity();
        scene.applyViewMatrix();

        scene.pushMatrix();
        scene.rotate(-Math.PI / 2, 1, 0, 0); // into terrain-model frame
        terrain.drawQuadDepth(-terrain.half_extent, terrain.half_extent, terrain.effective_size, 0, this.nearCullBox(terrain), null);
        scene.popMatrix();

        mat4.multiply(this.near_frozen, cam.getProjectionMatrix(this.near_size, this.near_size), cam.getViewMatrix());
        this.near_rendered = true;
        this.near_center[0] = wagon.position_x;
        this.near_center[1] = wagon.position_z;
    }

    // Model-space AABB of the near map's ground footprint, to cull the depth walk.
    // Inflated by 1/sin(sun elevation) because the oblique sun stretches the square
    // light frustum across the ground, plus a radius of slack for casters just
    // outside it.
    nearCullBox(terrain) {
        const half = this.near_radius / Math.max(this.sun_dir[1], 0.2) + this.near_radius;
        const wmx = terrain._wmx;
        const wmy = terrain._wmy;
        return { minx: wmx - half, maxx: wmx + half, miny: wmy - half, maxy: wmy + half };
    }

    // Aim an ortho light camera at a square of half-extent r centred on `center`,
    // looking along the sun. The centre is snapped to the map's texel grid (along
    // the light's right/up axes) so the shadow doesn't shimmer as it follows.
    fitFollow(cam, size, r, center, back) {
        const right = vec3.normalize(vec3.create(), vec3.cross(vec3.create(), this.world_up, this.look_dir));
        const up = vec3.normalize(vec3.create(), vec3.cross(vec3.create(), this.look_dir, right));

        const wpt = (2 * r) / size; // world units per texel
        let ar = center[0] * right[0] + center[1] * right[1] + center[2] * right[2];
        let au = center[0] * up[0] + center[1] * up[1] + center[2] * up[2];
        const ad = center[0] * this.look_dir[0] + center[1] * this.look_dir[1] + center[2] * this.look_dir[2];
        ar = Math.round(ar / wpt) * wpt;
        au = Math.round(au / wpt) * wpt;
        const c = [
            right[0] * ar + up[0] * au + this.look_dir[0] * ad,
            right[1] * ar + up[1] * au + this.look_dir[1] * ad,
            right[2] * ar + up[2] * au + this.look_dir[2] * ad,
        ];

        cam.left = -r; cam.right = r; cam.bottom = -r; cam.top = r;
        cam.near = 1; cam.far = 2 * back;
        cam.setPosition([c[0] + this.sun_dir[0] * back, c[1] + this.sun_dir[1] * back, c[2] + this.sun_dir[2] * back]);
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
        this.wagon_rendered = true;
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
        gl.uniform2f(this.loc("u_terrain_shadow_bias"), this.terrain_bias[0], this.terrain_bias[1]);
        gl.uniform2f(this.loc("u_terrain_near_shadow_bias"), this.near_bias[0], this.near_bias[1]);
        gl.uniform2f(this.loc("u_wagon_shadow_bias"), this.wagon_bias[0], this.wagon_bias[1]);
        gl.uniform3f(this.loc("u_sun_eye_dir"), this.sun_eye[0], this.sun_eye[1], this.sun_eye[2]);
        gl.uniform1i(this.loc("u_shadow_enabled"), 1);
        gl.activeTexture(gl.TEXTURE0);
    }

    // Tell a shader to skip the shadow lookup entirely (but still pass the sun
    // direction so the wagon body still lights).
    disable(shader) {
        const gl = this.gl;
        this._prog = shader.program;
        gl.uniform3f(this.loc("u_sun_eye_dir"), this.sun_eye[0], this.sun_eye[1], this.sun_eye[2]);
        gl.uniform1i(this.loc("u_shadow_enabled"), 0);
    }
}
