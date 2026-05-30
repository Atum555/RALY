import { CGFscene, CGFcamera, CGFaxis, CGFappearance } from "../lib/CGF.js";
import { SkySphere } from "./sky/SkySphere.js";
import { HayBale } from "./obstacles/HayBale.js";
import { Rock } from "./obstacles/Rock.js";
import { Wagon } from "./wagon/Wagon.js";
import { Terrain } from "./terrain/Terrain.js";
import { MyFlowerPatch } from "./MyFlowerPatch.js";
import { Barn } from "./barn/Barn.js";
import { FpsCounter } from "./core/FpsCounter.js";
import { hexToRGB } from "./utils.js";

export class Scene extends CGFscene {
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
        this.camera = new CGFcamera(1.0, 0.01, 50000, vec3.fromValues(0, 0, 15), vec3.fromValues(0, 0, 0));
    }

    initLights() {
        const sun = this.lights[Scene.Lights.SUN];
        const SUN_COLOR = hexToRGB("#ffe6b3ff");
        sun.setPosition(15, 6, 6, 1);
        sun.setDiffuse(...SUN_COLOR);
        sun.setSpecular(...SUN_COLOR);
        sun.enable();
        sun.setVisible(true);
        sun.update();

        const moon = this.lights[Scene.Lights.MOON];
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

        // The wagon is always present (drivable), so only the inspection props
        // are part of the selectable dropdown.
        this.object_ids = {
            HayBale: 0,
            Rock: 1,
        };
        this.selected_object = 0;
    }

    initObjects() {
        // On-screen FPS readout, measured per rendered frame in display().
        this.fps_counter = new FpsCounter();
        this.last_display_time = performance.now();

        this.axis = new CGFaxis(this);
        this.sky_sphere = new SkySphere(this);

        this.haybale = new HayBale(this);
        this.rock = new Rock(this);
        this.wagon = new Wagon(this);

        // Environment
        this.terrain = new Terrain(this);
        this.flower_patch_1 = new MyFlowerPatch(this, 15, 10, 10);
        this.flower_patch_2 = new MyFlowerPatch(this, 20, 15, 15);
        this.barn = new Barn(this);

        this.selectable_objects = [this.haybale, this.rock];
        this.all_objects = [this.haybale, this.rock, this.wagon, this.sky_sphere];
    }

    // == Update ===========================================

    update() {
        // Calculate delta time
        const current_time = Date.now();
        this.delta_time = current_time - this.last_time;
        this.last_time = current_time;

        this.sky_sphere.update(this.delta_time);
        this.checkWagonControls();
        this.wagon.update(this.delta_time / 1000.0);
    }

    checkWagonControls() {
        if (!this.gui || !this.wagon) return;

        const dt = this.delta_time / 1000.0;
        const accel_step = this.wagon.acceleration_rate * dt;
        const brake_step = this.wagon.braking_rate * dt;
        const steer_step = this.wagon.steering_rate * dt;

        if (this.gui.isKeyPressed("KeyW")) this.wagon.accelerate(accel_step);
        if (this.gui.isKeyPressed("KeyS")) this.wagon.accelerate(-brake_step);

        const left = this.gui.isKeyPressed("KeyA");
        const right = this.gui.isKeyPressed("KeyD");

        if (left && !right) {
            this.wagon.steer(steer_step);
        } else if (right && !left) {
            this.wagon.steer(-steer_step);
        } else if (Math.abs(this.wagon.speed) > 0.01) {
            // Recenter the wheels while rolling with no steering input.
            if (this.wagon.steering_angle > 0) this.wagon.steer(-steer_step);
            else if (this.wagon.steering_angle < 0) this.wagon.steer(steer_step);
        }
    }

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
        this.sky_sphere.display();
        this.lights[Scene.Lights.SUN].update();

        // Ground
        this.pushMatrix();
        this.rotate(-Math.PI / 2, 1, 0, 0);
        this.scale(50, 50, 1);
        this.terrain.display();
        this.popMatrix();

        // Player wagon (drivable with W/A/S/D)
        this.wagon.display();

        // Flowers
        this.pushMatrix();
        this.translate(10, 0, 10);
        this.flower_patch_1.display();
        this.popMatrix();

        this.pushMatrix();
        this.translate(-10, 0, -10);
        this.flower_patch_2.display();
        this.popMatrix();

        // Barn
        this.pushMatrix();
        this.translate(15, 0, -15);
        this.barn.display();
        this.popMatrix();

        // Selectable inspection prop, off to the side
        this.pushMatrix();
        this.translate(-18, 0, 18);
        this.selectable_objects[this.selected_object].display();
        this.popMatrix();
    }

    // == Utils ============================================

    setDefaultAppearance() {
        this.setAmbient(0.2, 0.4, 0.8, 1.0);
        this.setDiffuse(0.2, 0.4, 0.8, 1.0);
        this.setSpecular(0.2, 0.4, 0.8, 1.0);
        this.setShininess(10.0);
    }
}
