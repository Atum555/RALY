import {
    CGFscene,
    CGFcamera,
    CGFaxis,
    CGFappearance,
    CGFtexture,
} from "../lib/CGF.js";
import { MyDiamond } from "./MyDiamond.js";
import { MyBarn } from "./MyBarn.js";
import { MyQuad } from "./MyQuad.js";
import { SkySphere } from "./sky/SkySphere.js";
import { Clouds } from "./sky/Clouds.js";
import { ObstacleScene } from "./obstacles/ObstacleScene.js";
import { MyTerrain } from "./MyTerrain.js";
import { MyFlowerPatch } from "./MyFlowerPatch.js";
import { MyWagon } from "./MyWagon.js";

export class MyScene extends CGFscene {
    constructor() {
        super();
    }

    init(application) {
        super.init(application);

        this.initCameras();
        this.initLights();
        this.initMaterials();

        this.gl.clearColor(1.0, 1.0, 1.0, 1.0);
        this.gl.clearDepth(100.0);
        this.gl.enable(this.gl.DEPTH_TEST);
        this.gl.enable(this.gl.CULL_FACE);
        this.gl.depthFunc(this.gl.LEQUAL);
        this.enableTextures(true);

        this.axis = new CGFaxis(this);
        this.diamond = new MyDiamond(this);
        this.sphere = new SkySphere(this);
        this.quad = new MyQuad(this);
        this.barn = new MyBarn(this);
        this.terrain = new MyTerrain(this);
        this.wagon = new MyWagon(this);
        this.flowerPatch1 = new MyFlowerPatch(this, 15, 10, 10);
        this.flowerPatch2 = new MyFlowerPatch(this, 20, 15, 15);
        this.obstacleScene = new ObstacleScene(this);
        this.objects = [this.diamond, this.sphere, this.quad, this.obstacleScene];

        this.cloudLayer = new Clouds(this, 5, 0.3, 50);

        this.objectIDs = {
            Diamond: 0,
            Sphere: 1,
            Quad: 2,
            ObstacleScene: 3,
        };
        this.selectedObject = 2;
        this.scaleFactor = 1;
        this.displayAxis = true;
        this.displayNormals = false;
        this.displayClouds = true;

        this.cloudYPosition = 5;
        this.cloudScrollSpeed = 0.1;
        this.cloudMode = 1;

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
        this.lastTime = Date.now();
        this.deltaTime = 0;

        this.setUpdatePeriod(50);
        this.cloudLayer.updateDayCycle();
    }

    checkWagonControls() {
        if (!this.gui || !this.wagon) {
            return;
        }

        const deltaSeconds = this.deltaTime / 1000.0;
        const accelerationStep = this.wagon.accelerationRate * deltaSeconds;
        const brakingStep = this.wagon.brakingRate * deltaSeconds;
        const steeringStep = this.wagon.steeringRate * deltaSeconds;

        if (this.gui.isKeyPressed("KeyW")) {
            this.wagon.accelerate(accelerationStep);
        }

        if (this.gui.isKeyPressed("KeyS")) {
            this.wagon.accelerate(-brakingStep);
        }

        const leftPressed = this.gui.isKeyPressed("KeyA");
        const rightPressed = this.gui.isKeyPressed("KeyD");

        if (leftPressed && !rightPressed) {
            this.wagon.steer(-steeringStep);
        } else if (rightPressed && !leftPressed) {
            this.wagon.steer(steeringStep);
        } else if (!leftPressed && !rightPressed) {
            if (this.wagon.steeringAngle > 0) {
                this.wagon.steer(-steeringStep);
            } else if (this.wagon.steeringAngle < 0) {
                this.wagon.steer(steeringStep);
            }
        }
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
        this.camera = new CGFcamera(
            0.4,
            0.1,
            500,
            vec3.fromValues(0, 0, 15),
            vec3.fromValues(0, 0, 0),
        );
    }

    initMaterials() {
        this.quadMaterial = new CGFappearance(this);
        this.quadMaterial.setAmbient(0.1, 0.1, 0.1, 1);
        this.quadMaterial.setDiffuse(0.9, 0.9, 0.9, 1);
        this.quadMaterial.setSpecular(0.1, 0.1, 0.1, 1);
        this.quadMaterial.setShininess(10.0);
        this.quadMaterial.loadTexture("textures/texture.jpg");
        this.quadMaterial.setTextureWrap("REPEAT", "REPEAT");
    }

    update() {
        const currentTime = Date.now();
        this.deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;

        this.cloudLayer.yPosition = this.cloudYPosition;
        this.cloudLayer.scrollSpeed = this.cloudScrollSpeed;
        this.cloudLayer.cloudDensity = this.cloudDensity;
        this.cloudLayer.cloudSoftness = this.cloudSoftness;
        this.cloudLayer.cycleActive = this.enableDayNightCycle;
        if (this.displayClouds) {
            this.cloudLayer.update(this.deltaTime);
        }

        this.checkWagonControls();
        this.wagon.update(this.deltaTime / 1000.0);
    }

    hexToRGB(hex) {
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
        return [0.5, 0.5, 0.5];
    }

    setDefaultAppearance() {
        this.setAmbient(0.2, 0.4, 0.8, 1.0);
        this.setDiffuse(0.2, 0.4, 0.8, 1.0);
        this.setSpecular(0.2, 0.4, 0.8, 1.0);
        this.setShininess(10.0);
    }

    display() {
        this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
        this.updateProjectionMatrix();
        this.loadIdentity();
        this.applyViewMatrix();

        this.lights[0].update();
        if (this.displayAxis) this.axis.display();

        this.setDefaultAppearance();

        this.quadMaterial.apply();

        this.pushMatrix();
        this.rotate(-Math.PI / 2, 1, 0, 0);
        this.scale(50, 50, 1);
        this.terrain.display();
        this.popMatrix();

        this.pushMatrix();
        this.translate(0, 0, 0);
        this.wagon.display();
        this.popMatrix();

        this.pushMatrix();
        this.translate(10, 0, 10);
        this.flowerPatch1.display();
        this.popMatrix();

        this.pushMatrix();
        this.translate(-10, 0, -10);
        this.flowerPatch2.display();
        this.popMatrix();

        this.pushMatrix();
        this.translate(15, 0, -15);
        this.barn.display();
        this.popMatrix();

        this.pushMatrix();
        this.translate(-18, 0, 18);
        this.scale(this.scaleFactor, this.scaleFactor, this.scaleFactor);
        this.objects[this.selectedObject].display();
        this.popMatrix();

        if (this.displayNormals) {
            this.objects[this.selectedObject].enableNormalViz();
        } else {
            this.objects[this.selectedObject].disableNormalViz();
        }

        if (this.displayClouds) {
            this.cloudLayer.display();
        }

    }
}
