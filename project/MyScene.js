import { CGFscene, CGFcamera, CGFaxis, CGFappearance } from "../lib/CGF.js";
import { SkySphere } from "./sky/SkySphere.js";
import { HayBale } from "./obstacles/HayBale.js";
import { Rock } from "./obstacles/Rock.js";
import { hexToRGB } from "./utils.js";

export class MyScene extends CGFscene {
    static Lights = Object.freeze({
        SUN: 0,
        MOON: 1,
    });

    // == Init =============================================

    constructor() {
        super();
    }

    init(application) {
        super.init(application);

        this.gl.clearColor(1.0, 1.0, 1.0, 1.0);
        this.gl.clearDepth(100.0);
        this.gl.enable(this.gl.DEPTH_TEST);
        this.gl.enable(this.gl.CULL_FACE);
        this.gl.depthFunc(this.gl.LEQUAL);
        this.enableTextures(true);

        this.setUpdatePeriod(50);
        this.last_time = Date.now();
        this.delta_time = 0;

        this.initCameras();
        this.initLights();
        this.initMaterials();
        this.initUIValues();
        this.initObjects();
    }

    initCameras() {
        this.camera = new CGFcamera(1.0, 0.01, 5000, vec3.fromValues(0, 0, 15), vec3.fromValues(0, 0, 0));
    }

    initLights() {
        const sun = this.lights[MyScene.Lights.SUN];
        const SUN_COLOR = hexToRGB("#ffe6b3ff");
        sun.setPosition(15, 6, 6, 1);
        sun.setDiffuse(...SUN_COLOR);
        sun.setSpecular(...SUN_COLOR);
        sun.enable();
        sun.setVisible(true);
        sun.update();

        const moon = this.lights[MyScene.Lights.MOON];
        const MOON_COLOR = hexToRGB("#334D80FF");
        moon.setPosition(15, 6, 6, 1);
        moon.setDiffuse(...MOON_COLOR);
        moon.setSpecular(...MOON_COLOR);
        moon.enable();
        moon.setVisible(true);
        moon.update();
    }

    initMaterials() {
        this.default_material = new CGFappearance(this);
        this.default_material.setAmbient(0.1, 0.1, 0.1, 1);
        this.default_material.setDiffuse(0.9, 0.9, 0.9, 1);
        this.default_material.setSpecular(0.1, 0.1, 0.1, 1);
        this.default_material.setShininess(10.0);
    }

    initUIValues() {
        // Top-level
        this.scale_factor = 1;
        this.display_axis = true;
        this.display_normals = false;

        this.object_ids = {
            HayBale: 0,
            Rock: 1,
        };
        this.selected_object = 0;

        // Sky
        this.sky_slices = 100;
        this.sky_stacks = 100;
        this.sky_radius = 500;

        // Sky > Sun
        this.sky_sun_day_night_cycle = false;

        // Sky > Clouds
        this.sky_clouds_display = true;
        this.sky_clouds_y_position = 5;
        this.sky_clouds_scroll_speed = 0.1;

        // Sky > Clouds > Appearance
        this.sky_clouds_appearance_scale = 0.3;
        this.sky_clouds_appearance_dark = 0.5;
        this.sky_clouds_appearance_light = 0.3;
        this.sky_clouds_appearance_cover = 0.2;
        this.sky_clouds_appearance_alpha = 8.0;

        // Sky > Clouds > Colors
        this.sky_clouds_colors_sky_tint = 0.5;
        this.sky_clouds_colors = {
            sky_colour_1: "#3366cc",
            sky_colour_2: "#6db3ff",
            night_colour_1: "#050b1a",
            night_colour_2: "#0a1329",
        };

        // Obstacles > Hay Bale
        this.obstacles_haybale_slices = 50;
        this.obstacles_haybale_stacks = 10;

        // Obstacles > Rock
        this.obstacles_rock_radius = 1;
        this.obstacles_rock_scale = 1.5;
    }

    initObjects() {
        this.axis = new CGFaxis(this);
        this.sky_sphere = new SkySphere(
            this,
            this.sky_clouds_y_position,
            this.sky_clouds_scroll_speed,
            this.sky_slices,
            this.sky_stacks,
            this.sky_radius,
        );
        this.sky_sphere.updateDayCycle();

        this.haybale = new HayBale(this, this.obstacles_haybale_slices, this.obstacles_haybale_stacks);
        this.rock = new Rock(this, this.obstacles_rock_radius, this.obstacles_rock_scale);

        this.selectable_objects = [this.haybale, this.rock];
        this.all_objects = [this.haybale, this.rock, this.sky_sphere];
    }

    // == Update ===========================================

    update() {
        // Calculate delta time
        const current_time = Date.now();
        this.delta_time = current_time - this.last_time;
        this.last_time = current_time;

        // Sync cloud layer with UI controls
        this.sky_sphere.yPosition = this.sky_clouds_y_position;
        this.sky_sphere.scrollSpeed = this.sky_clouds_scroll_speed;
        this.sky_sphere.cloudDensity = this.cloud_density;
        this.sky_sphere.cloudSoftness = this.cloud_softness;
        this.sky_sphere.cycleActive = this.sky_sun_day_night_cycle;
        // Update cloud animation
        if (this.sky_clouds_display) {
            this.sky_sphere.update(this.delta_time);
        }
    }

    display() {
        // Frame setup
        this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
        this.updateProjectionMatrix();
        this.loadIdentity();
        this.applyViewMatrix();

        // World transform
        this.setDefaultAppearance();
        // prettier-ignore
        const scale_matrix = [
            this.scale_factor, 0.0,               0.0,               0.0,
            0.0,               this.scale_factor, 0.0,               0.0,
            0.0,               0.0,               this.scale_factor, 0.0,
            0.0,               0.0,               0.0,               1.0,
        ];
        this.multMatrix(scale_matrix);

        // Normal visualization toggle
        for (const obj of this.all_objects) {
            if (this.display_normals) obj.enableNormalViz();
            else obj.disableNormalViz();
        }

        // Lights and axis
        if (this.display_axis) this.axis.display();
        if (this.sky_clouds_display) this.sky_sphere.display();
        this.lights[MyScene.Lights.SUN].update();

        // Scene objects
        this.selectable_objects[this.selected_object].display();
    }

    // == Utils ============================================

    setDefaultAppearance() {
        this.setAmbient(0.2, 0.4, 0.8, 1.0);
        this.setDiffuse(0.2, 0.4, 0.8, 1.0);
        this.setSpecular(0.2, 0.4, 0.8, 1.0);
        this.setShininess(10.0);
    }
}
