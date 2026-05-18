import { CGFscene, CGFcamera, CGFaxis, CGFappearance } from "../lib/CGF.js";
import { SkySphere } from "./sky/SkySphere.js";
import { Clouds } from "./sky/Clouds.js";
import { HayBale } from "./obstacles/HayBale.js";
import { Rock } from "./obstacles/Rock.js";

export class MyScene extends CGFscene {
    constructor() {
        super();
    }

    init(application) {
        super.init(application);

        this.initCameras();
        this.initLights();
        this.initMaterials();

        // Background color
        this.gl.clearColor(1.0, 1.0, 1.0, 1.0);
        this.gl.clearDepth(100.0);
        this.gl.enable(this.gl.DEPTH_TEST);
        this.gl.enable(this.gl.CULL_FACE);
        this.gl.depthFunc(this.gl.LEQUAL);
        this.enableTextures(true);

        // Initialize scene objects
        this.axis = new CGFaxis(this);
        this.sphere = new SkySphere(this);
        this.haybaleSlices = 50;
        this.haybaleStacks = 10;
        this.rockRadius = 1;
        this.rockScale = 1.5;
        this.haybale = new HayBale(this, this.haybaleSlices, this.haybaleStacks);
        this.rock = new Rock(this, this.rockRadius, this.rockScale);
        this.objects = [this.haybale, this.rock];

        // Initialize cloud layer
        this.cloudLayer = new Clouds(this, 5, 0.3, 50);

        // Labels and ID's for object selection on MyInterface
        this.objectIDs = {
            HayBale: 0,
            Rock: 1,
        };
        //Other variables connected to MyInterface
        this.selectedObject = 0;
        // Objects connected to MyInterface
        this.scaleFactor = 1;
        this.displayAxis = true;
        this.displayNormals = false;
        this.displayClouds = true;

        // Cloud layer controls
        this.cloudYPosition = 5;
        this.cloudScrollSpeed = 0.1;
        this.cloudMode = 1;

        // Cloud shader parameters
        this.cloudScale = 1.1;
        this.cloudDark = 0.5;
        this.cloudLight = 0.3;
        this.cloudCover = 0.2;
        this.cloudAlpha = 8.0;
        this.skyTint = 0.5;
        this.cloudColors = {
            SkyColour1: "#3366cc",
            SkyColour2: "#6db3ff",
            nightColour1: "#050b1a",
            nightColour2: "#0a1329",
        };
        this.enableDayNightCycle = false;
        // Time tracking for animation
        this.lastTime = Date.now();
        this.deltaTime = 0;

        this.setUpdatePeriod(50);
        this.cloudLayer.updateDayCycle();
    }

    initLights() {
        this.lights[0].setPosition(15, 6, 6, 1);
        this.lights[0].setDiffuse(1.0, 0.9, 0.7, 1.0);
        this.lights[0].setSpecular(1.0, 0.9, 0.7, 1.0);
        this.lights[0].enable();
        this.lights[0].setVisible(true);
        this.lights[0].update();

        this.lights[1].setPosition(15, 6, 6, 1);
        this.lights[1].setDiffuse(0.2, 0.3, 0.5, 1.0);
        this.lights[1].setSpecular(0.2, 0.3, 0.5, 1.0);
        this.lights[1].enable();
        this.lights[1].setVisible(true);
        this.lights[1].update();
    }

    initCameras() {
        this.camera = new CGFcamera(0.4, 0.1, 500, vec3.fromValues(0, 0, 15), vec3.fromValues(0, 0, 0));
    }

    initMaterials() {
        this.defaultMaterial = new CGFappearance(this);
        this.defaultMaterial.setAmbient(0.1, 0.1, 0.1, 1);
        this.defaultMaterial.setDiffuse(0.9, 0.9, 0.9, 1);
        this.defaultMaterial.setSpecular(0.1, 0.1, 0.1, 1);
        this.defaultMaterial.setShininess(10.0);
    }

    update() {
        // Calculate delta time
        const currentTime = Date.now();
        this.deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;

        // Sync cloud layer with UI controls
        this.cloudLayer.yPosition = this.cloudYPosition;
        this.cloudLayer.scrollSpeed = this.cloudScrollSpeed;
        this.cloudLayer.cloudDensity = this.cloudDensity;
        this.cloudLayer.cloudSoftness = this.cloudSoftness;
        this.cloudLayer.cycleActive = this.enableDayNightCycle;
        // Update cloud animation
        if (this.displayClouds) {
            this.cloudLayer.update(this.deltaTime);
        }
    }

    hexToRGB(hex) {
        // Convert hex color string to RGB array (0-1 range)
        if (/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hex)) {
            if (hex.length === 4) {
                hex = "#" + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
            }
            return [
                parseInt(hex.substring(1, 3), 16) / 255.0,
                parseInt(hex.substring(3, 5), 16) / 255.0,
                parseInt(hex.substring(5, 7), 16) / 255.0,
            ];
        }
        return [0.5, 0.5, 0.5]; // fallback
    }

    setDefaultAppearance() {
        this.setAmbient(0.2, 0.4, 0.8, 1.0);
        this.setDiffuse(0.2, 0.4, 0.8, 1.0);
        this.setSpecular(0.2, 0.4, 0.8, 1.0);
        this.setShininess(10.0);
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
        if (this.displayClouds) {
            this.cloudLayer.display();
        }

        this.objects[this.selectedObject].display();

        if (this.displayNormals) this.objects[this.selectedObject].enableNormalViz();
        else this.objects[this.selectedObject].disableNormalViz();

        // ---- END Primitive drawing section
    }
}
