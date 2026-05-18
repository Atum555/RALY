import { CGFobject, CGFappearance, CGFshader } from "../../lib/CGF.js";
import { SkySphere } from "./SkySphere.js";
import { hexToRGB } from "../utils.js";

export class Clouds extends CGFobject {
    constructor(scene, yPosition = 5, scrollSpeed = 0.3) {
        super(scene);
        this.yPosition = yPosition;
        this.scrollSpeed = scrollSpeed;
        this.timeFactor = 0;
        this.cloudDensity = 0.38;
        this.cloudSoftness = 0.18;
        this.daySpeed = 0.005;
        this.timeOfDay = 2.5;
        this.cycleActive = true;
        this.sphere = new SkySphere(this.scene);
        this.initMaterial();
        this.initShaders();
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

    update(deltaTime) {
        this.timeFactor += this.scrollSpeed * deltaTime * 0.001;
        if (this.cycleActive) this.updateDayCycle();
    }

    updateDayCycle() {
        this.timeOfDay += this.daySpeed;

        var angle = (this.timeOfDay / (Math.PI * 2)) * Math.PI;
        var sunY = Math.sin(angle);

        this.dayFactor = Math.max(0, Math.min(1, (sunY - -0.1) / (0.2 - -0.1)));
        this.dayFactor = this.dayFactor * this.dayFactor; // more intense curve

        this.scene.sky_clouds_colors_skyTint = 0.2 + 0.3 * this.dayFactor;

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
        if(y > -buffer )
            sun.enable();
        else
            sun.disable();
        if(y < buffer)
            moon.enable();
        else
            moon.disable();

        sun.update();
        moon.update();
    }

    display() {
        this.scene.pushMatrix();
        this.cloudMaterial.apply();
        this.scene.setActiveShader(this.sphereShader);

        this.sphereShader.setUniformsValues({
            uSampler2: 1,
            timeFactor: this.timeFactor,
            cloudScale: 4.0,
            cloudscale: this.scene.sky_clouds_appearance_scale,
            clouddark: this.scene.sky_clouds_appearance_dark,
            cloudlight: this.scene.sky_clouds_appearance_light,
            cloudcover: this.scene.sky_clouds_appearance_cover,
            cloudalpha: this.scene.sky_clouds_appearance_alpha,
            skytint: this.scene.sky_clouds_colors_skyTint,
            skycolour1: hexToRGB(this.scene.sky_clouds_colors["SkyColour1"]).slice(0, 3),
            skycolour2: hexToRGB(this.scene.sky_clouds_colors["SkyColour2"]).slice(0, 3),
            nightcolour1: hexToRGB(this.scene.sky_clouds_colors["nightColour1"]).slice(0, 3),
            nightcolour2: hexToRGB(this.scene.sky_clouds_colors["nightColour2"]).slice(0, 3),
            sunangle: this.timeOfDay,
            dayfactor: this.dayFactor,
        });

        this.scene.translate(0, this.yPosition - 4 - 5, 0);
        this.scene.rotate(-Math.PI / 2, 1, 0, 0);
        this.sphere.display();

        this.scene.setActiveShader(this.scene.defaultShader);
        this.scene.popMatrix();
        this.scene.defaultMaterial.apply();
    }
}
