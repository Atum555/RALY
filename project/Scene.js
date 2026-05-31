import { CGFscene, CGFcamera } from "../lib/CGF.js";
import { SkySphere } from "./sky/SkySphere.js";
import { Wagon } from "./wagon/Wagon.js";
import { Terrain } from "./terrain/Terrain.js";
import { Barn } from "./barn/Barn.js";
import { HayBaleField } from "./obstacles/HayBaleField.js";
import { RockField } from "./obstacles/RockField.js";
import { ShadowMap } from "./lighting/ShadowMap.js";
import { FpsCounter } from "./core/FpsCounter.js";
import { patchCGFShaders } from "./core/patchCGFShaders.js";
import { lerpAngle } from "./utils.js";
import { GameState } from "./gameplay/GameState.js";

export class Scene extends CGFscene {
    // =====================================================
    // Init
    // =====================================================

    constructor() {
        super();
    }

    init(application) {
        super.init(application);

        // Replace CGF's per-shader-switch gl.getUniform readback (a synchronous
        // GPU pipeline stall, ~90% of the frame) with a JS-side uniform cache.
        patchCGFShaders();

        this.gl.clearColor(1.0, 1.0, 1.0, 1.0);
        this.gl.clearDepth(1.0);
        this.gl.enable(this.gl.DEPTH_TEST);
        this.gl.enable(this.gl.CULL_FACE);
        this.gl.depthFunc(this.gl.LEQUAL);
        this.enableTextures(true);

        this.setUpdatePeriod(1);
        this.last_time = performance.now();
        this.delta_time = 0;

        this.initCamera();
        this.initUIValues();
        this.initObjects();
        this.initGameplay();
    }

    initCamera() {
        this.camera = new CGFcamera(1.0, 1, 100000, vec3.fromValues(0, 0, 15), vec3.fromValues(0, 0, 0));

        // -- Soft chase-camera state --
        // The camera orbits an "anchor" (a point above the wagon) at a spherical
        // offset (yaw / pitch / distance). The mouse fully owns the camera while
        // the user drags or zooms; a couple of seconds after they stop, the
        // camera softly eases back to following: it tracks the wagon's position
        // and swings its yaw to behind the wagon, while keeping the zoom and
        // elevation the user chose. The easing is gentle, so a turn nudges the
        // camera around rather than snapping it.
        this.CAM_BEHIND = 40; // default horizontal follow distance
        this.CAM_HEIGHT = 15; // default camera height above the wagon
        this.CAM_LOOK_UP = 8; // anchor sits this far above the wagon
        this.CAM_LOOK_AHEAD = 8; // anchor sits this far forward of the wagon (along its heading)

        this.cam_anchor = vec3.fromValues(0, this.CAM_LOOK_UP, 0);
        this.cam_dist = Math.hypot(this.CAM_BEHIND, this.CAM_HEIGHT - this.CAM_LOOK_UP);
        this.cam_yaw = Math.PI; // directly behind the wagon when heading = 0
        // Default elevation behind/above the wagon. Follow eases cam_pitch back to
        // this once the mouse lets go, the same way yaw realigns to behind.
        this.CAM_REST_PITCH = Math.atan2(this.CAM_HEIGHT - this.CAM_LOOK_UP, this.CAM_BEHIND);
        this.cam_pitch = this.CAM_REST_PITCH;
        // Extra pitch that leans the whole rig with the slope the wagon is on,
        // so a climb tilts the view up the hill and a descent tilts it down.
        // Kept separate from cam_pitch (the user's chosen elevation); it eases in
        // while following and is folded back into cam_pitch (not double-applied)
        // the moment the mouse takes over. See syncOrbitFromCamera().
        this.cam_tilt = 0;

        // Base FOV the user controls from the UI; the Ctrl boost adds on top of
        // it and eases in/out so the projection doesn't snap. camera.fov itself
        // is owned by updateCamera() while boosting.
        this.cam_fov_base = this.camera.fov;
        this.CAM_BOOST_FOV = 0.3; // extra radians of FOV at full boost
        this.CAM_FOV_RATE = 6.0; // FOV easing rate (1/s)
        this.boosting = false;

        this.cam_last_manual_ms = -1e9; // follow is active from the start
        this.CAM_RESUME_DELAY = 3.0; // seconds of no input before follow resumes
        this.cam_move_start_ms = -1; // when the wagon began moving (-1 while stopped)
        this.CAM_MOVE_DELAY = 3.0; // seconds the wagon must move before follow engages
        this.CAM_POS_RATE = 15.0; // anchor easing rate (1/s)
        this.CAM_YAW_RATE = 3.0; // yaw realign rate (1/s); lower = softer turns
        this.CAM_PITCH_RATE = 3.0; // pitch realign rate (1/s) back to CAM_REST_PITCH
        this.CAM_TILT_RATE = 4.0; // tilt easing rate (1/s)
        this.CAM_TILT_GAIN = 0.9; // fraction of the wagon's slope to mirror
        this.CAM_PITCH_LIMIT = 1.4; // clamp on pitch (+tilt) so the rig can't go under the anchor or past overhead
    }

    initUIValues() {
        // Top-level
        this.display_normals = false;
    }

    initObjects() {
        // On-screen FPS readout, measured per rendered frame in display().
        this.fps_counter = new FpsCounter();
        this.last_display_time = performance.now();

        // Environment
        this.sky_sphere = new SkySphere(this);
        this.terrain = new Terrain(this);

        // Wagon
        this.wagon = new Wagon(this);
        this.barn = new Barn(this);

        // Loose hay bales strewn along the dirt paths as obstacles.
        this.haybales = new HayBaleField(this, this.terrain);

        // Rocks scattered over the open grass and path shoulders (never the flat
        // drivable path or the barn clearing). Built after the terrain and barn,
        // since it needs the terrain's height field, path network, and the barn's
        // clearing to place against.
        this.rock_field = new RockField(this);

        // Sun/moon shadow maps for the terrain and the wagon. Scene-owned: it
        // drives the depth pass each frame (display) and both the terrain and the
        // wagon sample the same maps. Built after the casters it renders.
        this.shadow_map = new ShadowMap(this);

        this.all_objects = [this.sky_sphere, this.terrain, this.wagon, this.barn, this.haybales, this.rock_field];
    }

    initGameplay() {
        this.game_state = new GameState();
        this._game_over_logged = false;

        // Barn delivery zone = the barn's pickup marker disc (the terrain already
        // paints a glow there). Lift the barn-local pickup spot into world space.
        const s = this.barn.barn_scale;
        this.barn_zone_x = this.barn.pos_x + this.barn.pickup.x * s;
        this.barn_zone_z = this.barn.pos_z + this.barn.pickup.z * s;
        this.barn_zone_r = this.barn.pickup.r * s;
        this.barn_delivered = false;

        // Solid barn footprint (world half-extents) for wagon collision: the
        // building's width/length scaled by barn_scale. The delivery zone sits
        // just in front of the door, outside this box, so it stays reachable.
        this.barn_half_x = (this.barn.width / 2) * s;
        this.barn_half_z = (this.barn.length / 2) * s;

        // The collectibles ARE the hay bales scattered across the field: the
        // pickup logic marks a placement collected, and the field then hides that
        // bale and drops its proximity arrow. Each placement is { x, y, z, yaw };
        // the collected flag is added lazily on pickup.
        this.bales = this.haybales.placements;
        // Bales are also solid obstacles (block + damage like rocks): tag each
        // with a per-bale cooldown and precompute its world-space box half-extents.
        // The HayBale mesh is a unit-squircle cross-section (radius 1 -> half-width
        // 1.0) extruded over a length of 3 and centred on the placement, so the
        // local footprint is 1.0 across x and 1.5 along z; the field scales the
        // whole bale. See GameState.checkBaleCollisions.
        for (const bale of this.bales) bale.damageCooldown = 0;
        this.bale_half_x = 1.0 * this.haybales.scale;
        this.bale_half_z = 1.5 * this.haybales.scale;

        // Hazard rocks: the wagon takes damage from the rocks scattered by the
        // RockField, so the rocks the player sees are exactly the ones that hurt.
        // Reuse the field's placements as the damage records, tagging each with a
        // per-rock cooldown (see GameState.checkRockCollisions). The field already
        // draws them, so there's no separate hazard-rock geometry.
        this.rocks = this.rock_field.placements;
        for (const rock of this.rocks) rock.damageCooldown = 0;

        this.initHUD();
    }

    // =====================================================
    // Update
    // =====================================================

    update() {
        // Game over freezes the whole update loop (movement, HP drain, camera);
        // display() keeps running, so the world stays on screen, frozen.
        if (this.game_state && this.game_state.game_over) {
            if (!this._game_over_logged) {
                this._game_over_logged = true;
                console.log("GAME OVER — Score: " + Math.floor(this.game_state.score));
                this.showGameOverScreen();
            }
            return;
        }

        // Calculate delta time
        const current_time = performance.now();
        this.delta_time = current_time - this.last_time;
        this.last_time = current_time;

        // Environment
        this.sky_sphere.update(this.delta_time);

        // Wagon
        this.applyWagonInput();
        this.wagon.update(this.delta_time / 1000.0);
        this.updateCamera();

        // Bob the hay-bale proximity arrows.
        this.haybales.update(this.delta_time / 1000.0);

        // Gameplay: HP drain + score, rock damage. Bale pickup (P) and barn
        // delivery (L) are both manual key actions — see UI.js.
        const delta = this.delta_time / 1000.0;
        this.game_state.update(delta);
        this.game_state.checkRockCollisions(this.wagon, this.rocks, delta);
        this.game_state.checkBaleCollisions(this.wagon, this.bales, this.bale_half_x, this.bale_half_z, delta);
        this.game_state.checkBarnCollision(
            this.wagon,
            this.barn.pos_x,
            this.barn.pos_z,
            this.barn_half_x,
            this.barn_half_z,
            delta,
        );

        this.updateHUD();
    }

    applyWagonInput() {
        if (!this.gui || !this.wagon) return;

        const dt = this.delta_time / 1000.0;
        const accel_step = this.wagon.acceleration_rate * dt;
        const brake_step = this.wagon.braking_rate * dt;
        const steer_step = this.wagon.steering_rate * dt;

        const throttle = this.gui.isKeyPressed("KeyW");
        const brake = this.gui.isKeyPressed("KeyS");

        // Shift boosts the top speed and (via updateCamera) widens the FOV for a
        // sense of speed. (Shift rather than Ctrl: Ctrl+W/S/A/D collide with
        // browser shortcuts like close-tab and save.)
        this.boosting = this.gui.isKeyPressed("ShiftLeft") || this.gui.isKeyPressed("ShiftRight");
        this.wagon.setBoost(this.boosting);

        if (throttle) this.wagon.accelerate(accel_step);
        if (brake) this.wagon.accelerate(-brake_step);

        // No throttle or brake: let drag coast the wagon to a stop.
        this.wagon.coasting = !throttle && !brake;

        const left = this.gui.isKeyPressed("KeyA");
        const right = this.gui.isKeyPressed("KeyD");

        if (left && !right) {
            this.wagon.steer(steer_step);
        } else if (right && !left) {
            this.wagon.steer(-steer_step);
        } else if (Math.abs(this.wagon.speed) > 0.01) {
            // Recenter the wheels while rolling with no steering input.
            // Snap to zero once we're within a step to avoid flickering past it.
            if (Math.abs(this.wagon.steering_angle) <= steer_step) this.wagon.steer(-this.wagon.steering_angle);
            else if (this.wagon.steering_angle > 0) this.wagon.steer(-steer_step);
            else if (this.wagon.steering_angle < 0) this.wagon.steer(steer_step);
        }
    }

    // Build the on-screen HUD: a plain DOM bar pinned to the top of the screen
    // showing the live health and score, layered over the canvas. Created once
    // when gameplay starts; refreshed every frame by updateHUD().
    initHUD() {
        if (document.getElementById("game-hud")) return;

        const hud = document.createElement("div");
        hud.id = "game-hud";
        Object.assign(hud.style, {
            position: "fixed",
            top: "0",
            left: "0",
            right: "0",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "32px",
            padding: "16px 24px",
            boxSizing: "border-box",
            color: "#fff",
            fontFamily: "sans-serif",
            fontSize: "22px",
            fontWeight: "bold",
            textShadow: "0 1px 3px rgba(0, 0, 0, 0.8)",
            pointerEvents: "none",
            zIndex: "900",
        });

        // Health (a coloured bar + readout) and score sit together, centred at the
        // top of the screen.
        const health = document.createElement("div");
        Object.assign(health.style, { display: "flex", alignItems: "center", gap: "10px" });

        const health_label = document.createElement("span");
        health_label.textContent = "HP";

        const health_track = document.createElement("div");
        Object.assign(health_track.style, {
            width: "200px",
            height: "18px",
            border: "2px solid #fff",
            borderRadius: "9px",
            overflow: "hidden",
            background: "rgba(0, 0, 0, 0.3)",
        });
        this._hud_health_fill = document.createElement("div");
        Object.assign(this._hud_health_fill.style, {
            height: "100%",
            width: "100%",
            background: "#3cdc4b",
            transition: "width 0.1s linear, background 0.2s linear",
        });
        health_track.appendChild(this._hud_health_fill);

        this._hud_health_text = document.createElement("span");

        health.append(health_label, health_track, this._hud_health_text);

        this._hud_score = document.createElement("div");

        hud.append(health, this._hud_score);
        document.body.appendChild(hud);

        this.updateHUD();
    }

    // Push the current HP/score into the HUD elements. Cheap enough to run every
    // frame: it just sets a width and two text strings.
    updateHUD() {
        if (!this._hud_health_fill) return;

        const hp = Math.max(0, Math.round(this.game_state.hp));
        // Bar fills relative to max HP; colour keys off the same fraction.
        const pct = (hp / this.game_state.max_hp) * 100;
        this._hud_health_fill.style.width = pct + "%";
        // Green when healthy, fading to red as it drains.
        this._hud_health_fill.style.background = pct > 50 ? "#3cdc4b" : pct > 25 ? "#e0c020" : "#dc3c3c";
        this._hud_health_text.textContent = hp;

        this._hud_score.textContent = "Score: " + Math.floor(this.game_state.score) + " s";
    }

    // Build and show the game-over overlay (a plain DOM element layered over the
    // canvas) once HP hits zero. The frozen world keeps rendering behind it. The
    // Restart button just reloads the page, which rebuilds a fresh scene/run.
    showGameOverScreen() {
        if (document.getElementById("game-over-overlay")) return;

        const overlay = document.createElement("div");
        overlay.id = "game-over-overlay";
        Object.assign(overlay.style, {
            position: "fixed",
            inset: "0",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "24px",
            background: "rgba(0, 0, 0, 0.7)",
            color: "#fff",
            fontFamily: "sans-serif",
            zIndex: "1000",
        });

        const title = document.createElement("div");
        title.textContent = "GAME OVER";
        Object.assign(title.style, { fontSize: "64px", fontWeight: "bold", letterSpacing: "4px" });

        const score = document.createElement("div");
        score.textContent = "Score: " + Math.floor(this.game_state.score) + " s";
        Object.assign(score.style, { fontSize: "28px" });

        const restart = document.createElement("button");
        restart.textContent = "Restart";
        Object.assign(restart.style, {
            fontSize: "24px",
            padding: "12px 36px",
            cursor: "pointer",
            border: "2px solid #fff",
            borderRadius: "8px",
            background: "transparent",
            color: "#fff",
            // Animate the hover state: grow slightly, invert to a filled look and
            // glow. The transition makes both enter and leave ease smoothly.
            transition: "transform 0.15s ease, background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease",
        });
        restart.onmouseenter = () => {
            Object.assign(restart.style, {
                transform: "scale(1.1)",
                background: "#fff",
                color: "#000",
                boxShadow: "0 0 20px rgba(255, 255, 255, 0.6)",
            });
        };
        restart.onmouseleave = () => {
            Object.assign(restart.style, {
                transform: "scale(1)",
                background: "transparent",
                color: "#fff",
                boxShadow: "none",
            });
        };
        restart.onclick = () => location.reload();

        overlay.append(title, score, restart);
        document.body.appendChild(overlay);
    }

    // Soft chase camera. See initCameras() for the overall design. The anchor
    // tracks the wagon's position every frame; only the yaw realignment waits
    // for the manual-input delay.
    updateCamera() {
        if (!this.wagon) return;

        const now = performance.now();
        const dt = Math.min(this.delta_time / 1000.0, 0.1);

        // Is the user actively controlling the camera right now? Mouse drags
        // show up as held buttons; wheel-zoom stamps cam_last_manual_ms (UI.js).
        const dragging = !!(this.gui && this.gui.mouseButtons && this.gui.mouseButtons.some(Boolean));
        if (dragging) this.cam_last_manual_ms = now;
        const since_manual = (now - this.cam_last_manual_ms) / 1000.0;
        const manual_active = dragging || since_manual < 0.2; // 0.2s tail covers wheel ticks

        // The chase camera only follows while the wagon is actually rolling, and
        // only after it has been moving for a short settle delay. A stationary
        // wagon leaves the camera holding its spot (the mouse still owns it), and
        // a brief nudge of speed won't immediately swing the view around.
        const moving = Math.abs(this.wagon.speed) > 0.01;
        if (moving) {
            if (this.cam_move_start_ms < 0) this.cam_move_start_ms = now;
        } else {
            this.cam_move_start_ms = -1;
        }
        const moving_settled = moving && (now - this.cam_move_start_ms) / 1000.0 >= this.CAM_MOVE_DELAY;

        // Follow is active once the wagon has rolled past the settle delay and the
        // mouse has been idle past its hold window (and no drag is in progress).
        const following = moving_settled && !manual_active && since_manual >= this.CAM_RESUME_DELAY;

        if (manual_active) {
            // The interface just orbited/zoomed the camera around its target;
            // capture that yaw/pitch/distance so we keep it once follow resumes.
            this.syncOrbitFromCamera();
        } else if (following) {
            // After the hold, ease the yaw toward directly-behind the wagon so a
            // turn nudges the view around rather than snapping it.
            const ky = 1 - Math.exp(-this.CAM_YAW_RATE * dt);
            this.cam_yaw = lerpAngle(this.cam_yaw, this.wagon.heading + Math.PI, ky);
            // Likewise ease the elevation back to its default angle relative to
            // the wagon, so releasing the mouse settles to the resting pitch
            // rather than holding whatever the drag left.
            const kpitch = 1 - Math.exp(-this.CAM_PITCH_RATE * dt);
            this.cam_pitch += (this.CAM_REST_PITCH - this.cam_pitch) * kpitch;
        }
        // (Until the wagon has rolled past the settle delay, the yaw/pitch stay
        // frozen so the view doesn't pan or pitch around — but the anchor below
        // still tracks the wagon, so the camera keeps following its position.)

        // Lean the rig into the slope while following; hold it level otherwise so
        // the mouse keeps full control of the elevation. wagon.pitch is negative
        // nose-up, so this dips the camera on a climb (looking up the hill) and
        // lifts it on a descent.
        const target_tilt = following ? this.wagon.pitch * this.CAM_TILT_GAIN : 0;
        const kt = 1 - Math.exp(-this.CAM_TILT_RATE * dt);
        this.cam_tilt += (target_tilt - this.cam_tilt) * kt;

        // Position always follows the wagon: ease the anchor toward a point a bit
        // ahead of it along its heading, so the camera looks where the wagon is
        // going rather than straight at it.
        const target = vec3.fromValues(
            this.wagon.position_x + this.CAM_LOOK_AHEAD * Math.sin(this.wagon.heading),
            this.wagon.position_y + this.CAM_LOOK_UP,
            this.wagon.position_z + this.CAM_LOOK_AHEAD * Math.cos(this.wagon.heading),
        );
        const kp = 1 - Math.exp(-this.CAM_POS_RATE * dt);
        vec3.lerp(this.cam_anchor, this.cam_anchor, target, kp);

        // Ease the FOV toward the (boosted) target so the widen/settle is smooth.
        const target_fov = this.cam_fov_base + (this.boosting ? this.CAM_BOOST_FOV : 0);
        const kf = 1 - Math.exp(-this.CAM_FOV_RATE * dt);
        this.camera.fov += (target_fov - this.camera.fov) * kf;

        this.applyCamState();
    }

    // Capture the orbit offset (yaw/pitch/distance) the user's mouse produced,
    // measured from the camera's current look target.
    syncOrbitFromCamera() {
        const p = this.camera.position;
        const t = this.camera.target;
        const ox = p[0] - t[0];
        const oy = p[1] - t[1];
        const oz = p[2] - t[2];
        this.cam_dist = Math.hypot(ox, oy, oz) || 1e-3;
        this.cam_yaw = Math.atan2(ox, oz);
        // Clamp to the same limit applyCamState() enforces. A near-vertical drag
        // can recover up to ±π/2 here; capping it now means the view doesn't get
        // nudged down by the clamp the moment follow resumes.
        const L = this.CAM_PITCH_LIMIT;
        this.cam_pitch = Math.max(-L, Math.min(L, Math.asin(Math.max(-1, Math.min(1, oy / this.cam_dist)))));
        // The camera we just read already has the slope tilt baked in, so it is
        // now part of cam_pitch. Drop cam_tilt to zero here instead of easing it
        // out separately, otherwise applyCamState() would add the tilt a second
        // time and the view would jump the moment the mouse takes over.
        this.cam_tilt = 0;
    }

    // Write the orbit state (anchor + yaw/pitch/distance) back to the camera.
    applyCamState() {
        // The slope tilt rides on top of the user's chosen elevation; clamp the
        // sum so a steep hill can't swing the camera under the anchor or past
        // overhead.
        const L = this.CAM_PITCH_LIMIT;
        const pitch = Math.max(-L, Math.min(L, this.cam_pitch + this.cam_tilt));
        const horiz = this.cam_dist * Math.cos(pitch);
        this.camera.setPosition(
            vec3.fromValues(
                this.cam_anchor[0] + horiz * Math.sin(this.cam_yaw),
                this.cam_anchor[1] + this.cam_dist * Math.sin(pitch),
                this.cam_anchor[2] + horiz * Math.cos(this.cam_yaw),
            ),
        );
        this.camera.setTarget(vec3.fromValues(this.cam_anchor[0], this.cam_anchor[1], this.cam_anchor[2]));
    }

    // =====================================================
    // Display
    // =====================================================

    display() {
        // Per-frame FPS measurement (display() runs once per rendered frame).
        const now = performance.now();
        this.fps_counter.tick(now - this.last_display_time);
        this.last_display_time = now;

        // Frame setup
        this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
        this.updateProjectionMatrix();
        this.loadIdentity();
        this.applyViewMatrix();

        this.setDefaultAppearance();

        this.sky_sphere.display();

        // Shadow depth pass: render the sun/moon shadow maps once for the whole
        // frame, before the terrain and wagon sample them. The terrain's per-frame
        // state is refreshed first, since the near map re-renders the terrain at
        // the wagon-centred LOD. updateSun runs even with every map off, since it
        // drives the lighting in every surface shader. render() self-contains its
        // camera/framebuffer/matrix changes; it leaves the light ortho projection
        // bound, so restore the perspective afterwards.
        this.terrain.beginFrame();
        this.shadow_map.updateSun();
        if (this.shadow_map.enabled) {
            this.shadow_map.render(this.terrain);
            this.updateProjectionMatrix();
        }

        // Ground
        this.pushMatrix();
        this.rotate(-Math.PI / 2, 1, 0, 0);
        this.terrain.display();
        this.popMatrix();

        // Player wagon (drivable with W/A/S/D)
        this.wagon.display();

        // Barn
        this.barn.display();

        // Hay bales scattered along the paths — these are the collectibles
        // (collected ones hide themselves).
        this.haybales.display();

        // Proximity markers hovering over the uncollected bales near the wagon.
        this.haybales.displayArrows();

        // Scattered rocks on the grass and path shoulders. Drawn with the other
        // ground obstacles, in world space (the terrain's -90deg X rotation has
        // been popped above). Like the hay bales, the field activates its own
        // textured, shadow-aware shader (so the rocks both receive and cast the
        // sun's shadows), so no shader needs to be bound here first.
        this.rock_field.display();
    }

    // =====================================================
    // Utils
    // =====================================================

    setDefaultAppearance() {
        this.setAmbient(0.2, 0.4, 0.8, 1.0);
        this.setDiffuse(0.2, 0.4, 0.8, 1.0);
        this.setSpecular(0.2, 0.4, 0.8, 1.0);
        this.setShininess(10.0);
    }

    // Normal visualization toggle (driven by the UI checkbox, not per-frame).
    // Propagates to every scene object.
    enableNormalViz() {
        for (const obj of this.all_objects) obj.enableNormalViz();
    }

    disableNormalViz() {
        for (const obj of this.all_objects) obj.disableNormalViz();
    }
}
