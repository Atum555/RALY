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

        var x, y, z, xy;
        var nx, ny, nz;
        var lengthInv = 1 / this.radius;
        var s, t;

        var sliceStep = (2 * Math.PI) / this.slices;
        var stackStep = Math.PI / this.stacks;
        var sliceAngle, stackAngle;

        for (var i = 0; i <= this.stacks / 2; ++i) {
            stackAngle = Math.PI / 2 - i * stackStep;
            xy = this.radius * Math.cos(stackAngle);
            z = this.radius * Math.sin(stackAngle);

            for (var j = 0; j <= this.slices; ++j) {
                sliceAngle = j * sliceStep;

                x = xy * Math.cos(sliceAngle);
                y = xy * Math.sin(sliceAngle);
                this.vertices.push(x);
                this.vertices.push(y);
                this.vertices.push(z);

                nx = x * lengthInv;
                ny = y * lengthInv;
                nz = z * lengthInv;
                this.normals.push(-nx);
                this.normals.push(-ny);
                this.normals.push(-nz);

                s = j / this.slices;
                t = i / (this.stacks / 2);
                this.texCoords.push(s);
                this.texCoords.push(t);
            }
        }
        var k1, k2;
        for (var i = 0; i < this.stacks / 2; ++i) {
            k1 = i * (this.slices + 1);
            k2 = k1 + this.slices + 1;

            for (var j = 0; j < this.slices; ++j, ++k1, ++k2) {
                if (i != 0) {
                    this.indices.push(k1 + 1);
                    this.indices.push(k2);
                    this.indices.push(k1);
                }

                if (i != this.stacks - 1) {
                    this.indices.push(k2 + 1);
                    this.indices.push(k2);
                    this.indices.push(k1 + 1);
                }
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

        this.scene.translate(0, this.yPosition - 4 - 5, 0);
        this.scene.rotate(-Math.PI / 2, 1, 0, 0);
        super.display();

        this.scene.setActiveShader(this.scene.defaultShader);
        this.scene.popMatrix();
        this.scene.default_material.apply();
    }
}
