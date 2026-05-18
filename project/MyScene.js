import { CGFscene, CGFcamera, CGFaxis, CGFappearance } from "../lib/CGF.js";
import { SkySphere } from "./sky/SkySphere.js";
import { Clouds } from "./sky/Clouds.js";
import { HayBale } from "./obstacles/HayBale.js";
import { Rock } from "./obstacles/Rock.js";
import { hexToRGB } from "./utils.js";

export class MyScene extends CGFscene {
    // =====================================================
    // Init
    // =====================================================

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
        this.lastTime = Date.now();
        this.deltaTime = 0;

        this.initCameras();
        this.initLights();
        this.initMaterials();
        this.initUIValues();
        this.initObjects();
    }

    initCameras() {
        this.camera = new CGFcamera(0.4, 0.1, 500, vec3.fromValues(0, 0, 15), vec3.fromValues(0, 0, 0));
    }

    initLights() {
        const LIGHT_0_COLOR = hexToRGB("#ffe6b3ff");
        this.lights[0].setPosition(15, 6, 6, 1);
        this.lights[0].setDiffuse(...LIGHT_0_COLOR);
        this.lights[0].setSpecular(...LIGHT_0_COLOR);
        this.lights[0].enable();
        this.lights[0].setVisible(true);
        this.lights[0].update();

        const LIGHT_1_COLOR = hexToRGB("#334D80FF");
        this.lights[1].setPosition(15, 6, 6, 1);
        this.lights[1].setDiffuse(...LIGHT_1_COLOR);
        this.lights[1].setSpecular(...LIGHT_1_COLOR);
        this.lights[1].enable();
        this.lights[1].setVisible(true);
        this.lights[1].update();
    }

    initMaterials() {
        this.defaultMaterial = new CGFappearance(this);
        this.defaultMaterial.setAmbient(0.1, 0.1, 0.1, 1);
        this.defaultMaterial.setDiffuse(0.9, 0.9, 0.9, 1);
        this.defaultMaterial.setSpecular(0.1, 0.1, 0.1, 1);
        this.defaultMaterial.setShininess(10.0);
    }

    initUIValues() {
        // Top-level
        this.scaleFactor = 1;
        this.displayAxis = true;
        this.displayNormals = false;

        this.objectIDs = {
            HayBale: 0,
            Rock: 1,
        };
        this.selectedObject = 0;

        // Sky > Sun
        this.sky_sun_dayNightCycle = false;

        // Sky > Clouds
        this.sky_clouds_display = true;
        this.sky_clouds_mode = 1;
        this.sky_clouds_yPosition = 5;
        this.sky_clouds_scrollSpeed = 0.1;

        // Sky > Clouds > Appearance
        this.sky_clouds_appearance_scale = 1.1;
        this.sky_clouds_appearance_dark = 0.5;
        this.sky_clouds_appearance_light = 0.3;
        this.sky_clouds_appearance_cover = 0.2;
        this.sky_clouds_appearance_alpha = 8.0;

        // Sky > Clouds > Colors
        this.sky_clouds_colors_skyTint = 0.5;
        this.sky_clouds_colors = {
            SkyColour1: "#3366cc",
            SkyColour2: "#6db3ff",
            nightColour1: "#050b1a",
            nightColour2: "#0a1329",
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
        this.sphere = new SkySphere(this);
        this.haybale = new HayBale(this, this.obstacles_haybale_slices, this.obstacles_haybale_stacks);
        this.rock = new Rock(this, this.obstacles_rock_radius, this.obstacles_rock_scale);
        this.objects = [this.haybale, this.rock];

        this.cloudLayer = new Clouds(this, this.sky_clouds_yPosition, this.sky_clouds_scrollSpeed, 50);
        this.cloudLayer.updateDayCycle();
    }

    // =====================================================
    // Update
    // =====================================================

    update() {
        // Calculate delta time
        const currentTime = Date.now();
        this.deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;

        // Sync cloud layer with UI controls
        this.cloudLayer.yPosition = this.sky_clouds_yPosition;
        this.cloudLayer.scrollSpeed = this.sky_clouds_scrollSpeed;
        this.cloudLayer.cloudDensity = this.cloudDensity;
        this.cloudLayer.cloudSoftness = this.cloudSoftness;
        this.cloudLayer.cycleActive = this.sky_sun_dayNightCycle;
        // Update cloud animation
        if (this.sky_clouds_display) {
            this.cloudLayer.update(this.deltaTime);
        }
    }

    display() {
        // ---- BEGIN Background, camera and axis setup
        // Clear image and depth buffer every time we update the scene
        this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
        // Initialize Model-View matrix as identity (no transformation)
        this.updateProjectionMatrix();
        this.loadIdentity();
        // Apply transformations corresponding to the camera position relative to the origin
        this.applyViewMatrix();

        this.lights[0].update();
        // Draw axis
        if (this.displayAxis) this.axis.display();

        this.setDefaultAppearance();

        // prettier-ignore
        var sca = [
            this.scaleFactor, 0.0, 0.0, 0.0, 0.0,
            this.scaleFactor, 0.0, 0.0, 0.0, 0.0,
            this.scaleFactor, 0.0, 0.0, 0.0, 0.0,
            1.0,
        ];

        this.multMatrix(sca);

        // ---- BEGIN Primitive drawing section

        this.pushMatrix();
        this.translate(0, -4, 0);
        this.rotate(-Math.PI / 2, 1, 0, 0);
        this.sphere.display();
        this.popMatrix();

        // Display clouds
        if (this.sky_clouds_display) {
            this.cloudLayer.display();
        }

        this.objects[this.selectedObject].display();

        if (this.displayNormals) this.objects[this.selectedObject].enableNormalViz();
        else this.objects[this.selectedObject].disableNormalViz();

        // ---- END Primitive drawing section
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
}
