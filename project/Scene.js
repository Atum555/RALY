import { CGFscene, CGFcamera, CGFaxis, CGFappearance } from "../lib/CGF.js";
import { SkySphere } from "./sky/SkySphere.js";
import { HayBale } from "./obstacles/HayBale.js";
import { Rock } from "./obstacles/Rock.js";
import { Wagon } from "./wagon/Wagon.js";
import { Barn } from "./barn/Barn.js";
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
        this.camera = new CGFcamera(1.0, 0.01, 5000, vec3.fromValues(0, 0, 15), vec3.fromValues(0, 0, 0));
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

        this.object_ids = {
            HayBale: 0,
            Rock: 1,
            Wagon: 2,
            Barn: 3,
        };
        this.selected_object = 3;
    }

    initObjects() {
        this.axis = new CGFaxis(this);
        this.sky_sphere = new SkySphere(this);

        this.haybale = new HayBale(this);
        this.rock = new Rock(this);
        this.wagon = new Wagon(this);
        this.barn = new Barn(this);

        this.selectable_objects = [this.haybale, this.rock, this.wagon, this.barn];
        this.all_objects = [this.haybale, this.rock, this.wagon, this.sky_sphere, this.barn];
    }

    // == Update ===========================================

    update() {
        // Calculate delta time
        const current_time = Date.now();
        this.delta_time = current_time - this.last_time;
        this.last_time = current_time;

        this.sky_sphere.update(this.delta_time);
        this.wagon.update();
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
        this.sky_sphere.display();
        this.lights[Scene.Lights.SUN].update();

        // Scene objects
        this.selectable_objects[this.selected_object].display();
        this.wagon.display();
    }

    // == Utils ============================================

    setDefaultAppearance() {
        this.setAmbient(0.2, 0.4, 0.8, 1.0);
        this.setDiffuse(0.2, 0.4, 0.8, 1.0);
        this.setSpecular(0.2, 0.4, 0.8, 1.0);
        this.setShininess(10.0);
    }
}
