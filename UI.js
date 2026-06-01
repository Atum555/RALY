import { CGFinterface, dat } from "./lib/CGF.js";
import { readonly } from "./utils.js";

export class UI extends CGFinterface {
    constructor() {
        super();
    }

    init(application) {
        super.init(application);

        // init GUI. For more information on the methods, check:
        // https://github.com/dataarts/dat.gui/blob/master/API.md
        this.gui = new dat.GUI();

        // == Game =============================================
        {
            // Live gameplay telemetry: read-only, kept in sync via listen().
            const gs = this.scene.game_state;
            const game_controls = this.gui.addFolder("Game");
            readonly(game_controls.add(gs, "hp").name("Health Points").listen());
            readonly(game_controls.add(gs, "score").name("Score (s)").listen());
            readonly(game_controls.add(gs, "bales_carried").name("Bales Carried").listen());
            readonly(game_controls.add(gs, "total_bales_delivered").name("Bales Delivered").listen());
            readonly(game_controls.add(gs, "last_damage").name("Last Damage").listen());
            readonly(game_controls.add(gs, "last_heal").name("Last Heal").listen());
            game_controls.open();
        }

        // == Camera ===========================================
        {
            const cam = this.scene.camera;
            const camera_controls = this.gui.addFolder("Camera");
            // Distance is also changed by wheel-zoom (see syncOrbitFromCamera), so
            // listen() keeps the slider in sync.
            camera_controls.add(this.scene, "cam_dist", 10, 10000).step(1).name("Distance").listen();
            // CGFcamera stores fov in radians; expose it in degrees. The slider
            // sets the base FOV (scene.cam_fov_base); the Ctrl boost is layered
            // on top of it each frame in updateCamera, so it owns cam.fov itself.
            const fov_deg = { value: (cam.fov * 180) / Math.PI };
            camera_controls
                .add(fov_deg, "value", 30, 120)
                .step(1)
                .name("FOV")
                .onChange(deg => {
                    this.scene.cam_fov_base = (deg * Math.PI) / 180;
                });
        }

        // == Shadows ==========================================
        {
            // Sun/moon shadow maps. Each toggle gates one map independently: a
            // disabled map skips its depth pass and is treated as lit, so the
            // surfaces still light from the sun/moon. Off across the board skips
            // the whole depth pass.
            const shadow_map = this.scene.shadow_map;
            const shadow_controls = this.gui.addFolder("Shadows");
            shadow_controls.add(shadow_map, "terrain_shadows").name("Terrain");
            shadow_controls.add(shadow_map, "terrain_detail_shadows").name("Terrain Detail");
            shadow_controls.add(shadow_map, "wagon_shadows").name("Wagon");
        }

        // == Sky ==============================================
        {
            const sky = this.scene.sky_sphere;
            const rebuild_sky = () => {
                sky.initBuffers();
                sky.initNormalVizBuffers();
            };
            const sky_controls = this.gui.addFolder("Sky");
            sky_controls.add(sky, "sky_radius", 10000, 100000).step(10).name("Radius").onChange(rebuild_sky);
            sky_controls.add(sky, "sky_slices", 4, 100).step(1).name("Slices").onChange(rebuild_sky);
            sky_controls.add(sky, "sky_stacks", 4, 100).step(1).name("Stacks").onChange(rebuild_sky);
            sky_controls.add(sky, "day_night_cycle_speed", 0.0, 50.0).step(1).name("Day/Night Speed");
            sky_controls.add(sky, "sky_sun_moon_display").name("Sun / Moon");

            var sky_colors = sky_controls.addFolder("Colors");
            sky_colors.addColor(sky.sky_colors, "sky_day_colour_1").name("Day Color 1");
            sky_colors.addColor(sky.sky_colors, "sky_day_colour_2").name("Day Color 2");
            sky_colors.addColor(sky.sky_colors, "sky_night_colour_1").name("Night Color 1");
            sky_colors.addColor(sky.sky_colors, "sky_night_colour_2").name("Night Color 2");

            // -- Clouds -------------------------------------------

            const cloud_controls = sky_controls.addFolder("Clouds");
            cloud_controls.add(sky, "sky_clouds_display").name("Display Clouds");
            cloud_controls.add(sky, "sky_clouds_drift_speed", 0.0, 0.1).step(0.001).name("Drift Speed");
            cloud_controls.add(sky, "sky_clouds_scale", 0.001, 1.0).step(0.01).name("Scale");
            cloud_controls.add(sky, "sky_clouds_alpha", 0.0, 20.0).step(0.5).name("Alpha");
            cloud_controls.add(sky, "sky_clouds_cover", 0.0, 1.0).step(0.05).name("Cover");
            cloud_controls.add(sky, "sky_clouds_light", 0.0, 1.0).step(0.05).name("Light");
            cloud_controls.add(sky, "sky_clouds_dark", 0.0, 1.0).step(0.05).name("Dark");
        }

        // == Terrain ==========================================
        {
            const terrain = this.scene.terrain;
            // Rebuild the mesh buffers and re-push the shader's static uniforms:
            // some of them (e.g. u_path_dirt_edge) derive from these controls and
            // are set once in initShaders, so they need a refresh on change. The
            // textures depend on no control, so they are not reloaded here.
            const rebuild_terrain = () => {
                terrain.initHeightField();
                terrain.initShaders();
            };
            const terrain_controls = this.gui.addFolder("Terrain");

            // -- Size ---------------------------------------------
            // A target terrain size is requested; the effective (actual) size is
            // snapped to a whole number of leaf tiles and shown read-only.
            terrain_controls
                .add(terrain, "terrain_size", 100, 50000)
                .step(100)
                .name("Terrain Size")
                .onChange(rebuild_terrain);
            readonly(terrain_controls.add(terrain, "effective_size").name("Effective Size (derived)").listen());

            // -- Height field -------------------------------------

            const height_controls = terrain_controls.addFolder("Height Field");
            height_controls.add(terrain, "terrain_noise_seed", 0, 9999).step(1).name("Seed").onChange(rebuild_terrain);
            height_controls
                .add(terrain, "terrain_min_height", 0, 1000)
                .step(1)
                .name("Height (origin)")
                .onChange(rebuild_terrain);
            height_controls
                .add(terrain, "terrain_mid_height", 0, 1000)
                .step(1)
                .name("Height (mid)")
                .onChange(rebuild_terrain);
            height_controls
                .add(terrain, "terrain_max_height", 0, 1500)
                .step(1)
                .name("Height (edge)")
                .onChange(rebuild_terrain);
            height_controls
                .add(terrain, "terrain_mid_radius", 0.01, 0.99)
                .step(0.01)
                .name("Mid Radius")
                .onChange(rebuild_terrain);
            height_controls
                .add(terrain, "terrain_noise_scale", 0.0005, 0.02)
                .step(0.0005)
                .name("Noise Scale")
                .onChange(rebuild_terrain);
            height_controls
                .add(terrain, "terrain_noise_octaves", 1, 50)
                .step(1)
                .name("Octaves")
                .onChange(rebuild_terrain);

            // -- LOD ----------------------------------------------
            // Quadtree level-of-detail: the terrain is tiled by the leaf (finest) tile
            // size, and each tile is subdivided by the detail density. The LOD level
            // count and per-tile subdivisions fall out of these and are shown read-only.
            // The split factor (detail reach) is applied every frame from its bound
            // value, so it needs no rebuild; the rest rebuild the buffers on change.
            const lod_controls = terrain_controls.addFolder("LOD");
            lod_controls.add(terrain, "terrain_lod_enabled").name("Enable").onChange(rebuild_terrain);
            readonly(lod_controls.add(terrain, "lod_levels").name("LOD Levels (derived)").listen());
            readonly(
                lod_controls.add(terrain, "effective_tile_subdivisions").name("Tile Subdivisions (derived)").listen(),
            );
            lod_controls
                .add(terrain, "terrain_lod_tile_size", 20, 2000)
                .step(10)
                .name("Tile Size")
                .onChange(rebuild_terrain);
            lod_controls
                .add(terrain, "terrain_lod_detail_density", 1, 400)
                .step(1)
                .name("Detail Density")
                .onChange(rebuild_terrain);
            lod_controls.add(terrain, "terrain_lod_split_factor", 1.5, 5).step(0.1).name("Detail Reach");

            // -- Paths --------------------------------------------

            const path_controls = terrain_controls.addFolder("Paths");
            path_controls.add(terrain, "terrain_paths_enabled").name("Enable").onChange(rebuild_terrain);
            path_controls.add(terrain, "terrain_path_seed", 0, 9999).step(1).name("Seed").onChange(rebuild_terrain);
            readonly(path_controls.add(terrain, "effective_path_count").name("Node Count (derived)").listen());
            path_controls
                .add(terrain, "terrain_path_node_density", 0, 20)
                .step(0.1)
                .name("Node Density")
                .onChange(rebuild_terrain);
            path_controls.add(terrain, "terrain_path_width", 1, 30).step(1).name("Width").onChange(rebuild_terrain);
            path_controls
                .add(terrain, "terrain_path_shoulder", 1, 50)
                .step(1)
                .name("Shoulder")
                .onChange(rebuild_terrain);
            path_controls
                .add(terrain, "terrain_path_smoothing", 0, 60)
                .step(1)
                .name("Smoothing")
                .onChange(rebuild_terrain);
            path_controls
                .add(terrain, "terrain_path_slope_weight", 0, 100)
                .step(1)
                .name("Slope Avoidance")
                .onChange(rebuild_terrain);

            // -- Central clearing ---------------------------------
            // Levelled, dirt-covered circular pad at the world origin for the barn,
            // with independent radii for the flatness and the dirt texture.
            const clearing_controls = terrain_controls.addFolder("Central Clearing");
            clearing_controls.add(terrain, "terrain_clearing_enabled").name("Enable").onChange(rebuild_terrain);
            clearing_controls
                .add(terrain, "terrain_clearing_flat_radius", 0, 500)
                .step(1)
                .name("Flat Radius")
                .onChange(rebuild_terrain);
            clearing_controls
                .add(terrain, "terrain_clearing_texture_radius", 0, 500)
                .step(1)
                .name("Texture Radius")
                .onChange(rebuild_terrain);
            clearing_controls
                .add(terrain, "terrain_clearing_flatness", 0, 1)
                .step(0.05)
                .name("Flatness")
                .onChange(rebuild_terrain);
            clearing_controls
                .add(terrain, "terrain_clearing_shoulder", 1, 400)
                .step(1)
                .name("Shoulder")
                .onChange(rebuild_terrain);

            // -- Fog ----------------------------------------------
            // Distance fog fading distant terrain into the sky's horizon colour; the
            // colour tracks the day/night cycle, so only the band is tunable here.
            const fog_controls = terrain_controls.addFolder("Fog");
            fog_controls.add(terrain, "fog_enabled").name("Enable");
            fog_controls.add(terrain, "fog_start", 0, 2000).step(200).name("Start");
            fog_controls.add(terrain, "fog_end", 0, 20000).step(200).name("End");
        }

        // == Wagon ============================================
        {
            const wagon = this.scene.wagon;
            const wagon_controls = this.gui.addFolder("Wagon");

            // Live driving telemetry, read-only and kept in sync via listen().
            readonly(wagon_controls.add(wagon, "acceleration").name("Acceleration").listen());
            readonly(wagon_controls.add(wagon, "speed").name("Speed").listen());
            readonly(wagon_controls.add(wagon, "steering_angle_degrees").name("Steering Angle (deg)").listen());
        }

        // == Flower Field =====================================
        {
            const field = this.scene.flower_field;
            const field_controls = this.gui.addFolder("Flower Field");
            field_controls.add(field, "enabled").name("Enable");
            field_controls.add(field, "base_scale", 0.5, 6).step(0.1).name("Size");
            field_controls.add(field, "density_bias", 0.0, 0.9).step(0.01).name("Sparsity");
            field_controls.add(field, "base_per_cell", 0, 12).step(1).name("Base Density");
            field_controls.add(field, "max_per_cell", 1, 24).step(1).name("Cluster Size");
            field_controls.add(field, "density_scale", 0.001, 0.02).step(0.001).name("Patch Frequency");
            field_controls.add(field, "draw_radius", 50, 800).step(10).name("Draw Radius");
            field_controls.add(field, "draw_budget", 50, 3000).step(20).name("Max Drawn");
        }

        // == Grass ============================================

        {
            const grass = this.scene.grassPatch;
            const grass_controls = this.gui.addFolder("Grass");
            grass_controls.add(grass, "windEnabled").name("Wind Enabled");
            grass_controls.add(grass, "windStrength", 0, 2).step(0.1).name("Wind Strength");
            grass_controls.add(grass, "windSpeed", 0, 10).step(0.1).name("Wind Speed");
            grass_controls.add(grass, "windSpatialFreq", 0, 2).step(0.01).name("Wind Spatial Freq");
        }

        // == Scene ============================================
        {
            this.gui
                .add(this.scene, "display_normals")
                .name("Display Normals")
                .onChange(on => (on ? this.scene.enableNormalViz() : this.scene.disableNormalViz()));
        }

        this.initKeys();
        return true;
    }

    // == Keyboard (W/A/S/D wagon controls) ================

    initKeys() {
        this.scene.gui = this;
        this.processKeyboard = function () {};
        this.activeKeys = {};
    }

    processKeyDown(event) {
        this.activeKeys[event.code] = true;

        // Gameplay: P picks up a nearby bale, L delivers carried bales at the barn.
        if (this.scene.game_state) {
            if (event.code === "KeyP") {
                this.scene.game_state.checkBalePickup(this.scene.wagon, this.scene.bales);
            }
            if (event.code === "KeyL") {
                // Deliver carried bales; only fires when the wagon is inside the
                // barn drop-off circle (checkBarnDelivery does the zone check).
                this.scene.barn_delivered = this.scene.game_state.checkBarnDelivery(
                    this.scene.wagon,
                    this.scene.barn_zone_x,
                    this.scene.barn_zone_z,
                    this.scene.barn_zone_r,
                );
            }
        }
    }

    processKeyUp(event) {
        this.activeKeys[event.code] = false;
    }

    isKeyPressed(keyCode) {
        return this.activeKeys[keyCode] || false;
    }

    // Wheel-zoom is discrete (no held button), so stamp it as manual camera
    // input to keep the soft-follow camera from fighting the user's zoom.
    processWheel(event) {
        super.processWheel(event);
        if (this.scene) this.scene.cam_last_manual_ms = performance.now();
    }
}
