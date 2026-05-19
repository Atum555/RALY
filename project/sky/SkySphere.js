import { CGFobject, CGFappearance, CGFshader } from "../../lib/CGF.js";
import { hexToRGB } from "../utils.js";

export class SkySphere extends CGFobject {
    // =====================================================
    // Init
    // =====================================================

    constructor(scene, yPosition, scrollSpeed, slices, stacks, radius) {
        super(scene);
        this.yPosition = yPosition;
        this.scrollSpeed = scrollSpeed;
        this.timeFactor = 0;
        this.cloudDensity = 0.38;
        this.cloudSoftness = 0.18;
        this.daySpeed = 0.005;
        this.timeOfDay = 2.5;
        this.cycleActive = true;

        this.slices = slices;
        this.stacks = stacks;
        this.radius = radius;

        this.initBuffers();
        this.initMaterial();
        this.initShaders();
    }

    initBuffers() {
        this.vertices = [];
        this.indices = [];
        this.normals = [];
        this.texCoords = [];

        let posX, posY, posZ, ringRadius;
        let normalX, normalY, normalZ;
        const inverseRadius = 1 / this.radius;
        let texU, texV;

        const halfStacks = Math.floor(this.stacks / 2);
        const sliceAngleStep = (2 * Math.PI) / this.slices;
        const stackAngleStep = Math.PI / 2 / halfStacks;
        let sliceAngle, stackAngle;

        for (let stackIndex = 0; stackIndex <= halfStacks; ++stackIndex) {
            stackAngle = Math.PI / 2 - stackIndex * stackAngleStep;
            ringRadius = this.radius * Math.cos(stackAngle);
            posY = this.radius * Math.sin(stackAngle);

            for (let sliceIndex = 0; sliceIndex <= this.slices; ++sliceIndex) {
                sliceAngle = sliceIndex * sliceAngleStep;

                posX = ringRadius * Math.cos(sliceAngle);
                posZ = -ringRadius * Math.sin(sliceAngle);
                this.vertices.push(posX);
                this.vertices.push(posY);
                this.vertices.push(posZ);

                normalX = posX * inverseRadius;
                normalY = posY * inverseRadius;
                normalZ = posZ * inverseRadius;
                this.normals.push(-normalX);
                this.normals.push(-normalY);
                this.normals.push(-normalZ);

                texU = sliceIndex / this.slices;
                texV = stackIndex / halfStacks;
                this.texCoords.push(texU);
                this.texCoords.push(texV);
            }
        }
        let currentRingStart, nextRingStart;
        for (let stackIndex = 0; stackIndex < halfStacks; ++stackIndex) {
            currentRingStart = stackIndex * (this.slices + 1);
            nextRingStart = currentRingStart + this.slices + 1;

            for (let sliceIndex = 0; sliceIndex < this.slices; ++sliceIndex, ++currentRingStart, ++nextRingStart) {
                if (stackIndex != 0) {
                    this.indices.push(currentRingStart + 1);
                    this.indices.push(nextRingStart);
                    this.indices.push(currentRingStart);
                }

                this.indices.push(nextRingStart + 1);
                this.indices.push(nextRingStart);
                this.indices.push(currentRingStart + 1);
            }
        }

        this.primitiveType = this.scene.gl.TRIANGLES;
        this.initGLBuffers();
    }

    initMaterial() {
        this.cloudMaterial = new CGFappearance(this.scene);
        this.cloudMaterial.setAmbient(1, 1, 1, 1);
        this.cloudMaterial.setDiffuse(0, 0, 0, 1);
        this.cloudMaterial.setSpecular(0, 0, 0, 0);
        this.cloudMaterial.setShininess(0);
        this.cloudMaterial.setEmission(1, 1, 1, 1);
    }

    initShaders() {
        this.sphereShader = new CGFshader(
            this.scene.gl,
            "sky/shaders/sphereClouds.vert",
            "sky/shaders/sphereClouds.frag",
        );
    }

    // =====================================================
    // Update
    // =====================================================

    update(deltaTime) {
        this.timeFactor += this.scrollSpeed * deltaTime * 0.001;
        if (this.cycleActive) this.updateDayCycle();
    }

    updateDayCycle() {
        this.timeOfDay += this.daySpeed;

        var angle = (this.timeOfDay / (Math.PI * 2)) * Math.PI;
        var sunY = Math.sin(angle);

        this.dayFactor = Math.max(0, Math.min(1, (sunY - -0.1) / (0.2 - -0.1)));
        this.dayFactor = this.dayFactor * this.dayFactor;

        this.scene.sky_clouds_colors_sky_tint = 0.2 + 0.3 * this.dayFactor;

        var radius = 20.0;
        var x = -2;
        var y = Math.sin(angle) * radius;
        var z = -Math.cos(angle) * radius;
        const { Lights } = this.scene.constructor;
        const sun = this.scene.lights[Lights.SUN];
        const moon = this.scene.lights[Lights.MOON];

        sun.setPosition(x, y - 3.5, -z, 1.0);
        moon.setPosition(x, -y + 3.5, z, 1.0);

        var buffer = 3.0;
        if (y > -buffer) sun.enable();
        else sun.disable();
        if (y < buffer) moon.enable();
        else moon.disable();

        sun.update();
        moon.update();
    }

    // =====================================================
    // Display
    // =====================================================

    display() {
        this.scene.pushMatrix();
        this.cloudMaterial.apply();
        this.scene.setActiveShader(this.sphereShader);

        this.sphereShader.setUniformsValues({
            uSampler2: 1,
            time_factor: this.timeFactor,
            radius: this.radius,
            cloud_scale: this.scene.sky_clouds_appearance_scale,
            cloud_dark: this.scene.sky_clouds_appearance_dark,
            cloud_light: this.scene.sky_clouds_appearance_light,
            cloud_cover: this.scene.sky_clouds_appearance_cover,
            cloud_alpha: this.scene.sky_clouds_appearance_alpha,
            sky_tint: this.scene.sky_clouds_colors_sky_tint,
            sky_colour1: hexToRGB(this.scene.sky_clouds_colors["sky_colour_1"]).slice(0, 3),
            sky_colour2: hexToRGB(this.scene.sky_clouds_colors["sky_colour_2"]).slice(0, 3),
            night_colour1: hexToRGB(this.scene.sky_clouds_colors["night_colour_1"]).slice(0, 3),
            night_colour2: hexToRGB(this.scene.sky_clouds_colors["night_colour_2"]).slice(0, 3),
            sun_angle: this.timeOfDay,
            day_factor: this.dayFactor,
        });
        super.display();

        this.scene.setActiveShader(this.scene.defaultShader);
        this.scene.popMatrix();
        this.scene.default_material.apply();
    }
}
