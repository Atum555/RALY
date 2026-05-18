import { CGFobject, CGFappearance, CGFshader } from "../../lib/CGF.js";
import { MyPlane } from "./MyPlane.js";
import { SkySphere } from "./SkySphere.js";

export class Clouds extends CGFobject {
    constructor(scene, yPosition = 5, scrollSpeed = 0.3, scale = 50) {
        super(scene);
        this.yPosition = yPosition;
        this.scrollSpeed = scrollSpeed;
        this.scale = scale;
        this.timeFactor = 0;
        this.cloudDensity = 0.38;
        this.cloudSoftness = 0.18;
        this.daySpeed = 0.005;
        this.timeOfDay = 2.5;
        this.cycleActive = true;
        this.quad = new MyPlane(this.scene, 50);
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
        this.flatShader = new CGFshader(
            this.scene.gl,
            "sky/shaders/flatClouds.vert",
            "sky/shaders/flatClouds.frag",
        );
        this.shpereShader = new CGFshader(
            this.scene.gl,
            "sky/shaders/sphereClouds.vert",
            "sky/shaders/sphereClouds.frag",
        );
        this.shaders = [this.flatShader, this.shpereShader];
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

        this.scene.skyTint = 0.2 + 0.3 * this.dayFactor;

        var radius = 20.0;
        var x = -2;
        var y = Math.sin(angle) * radius;
        var z = -Math.cos(angle) * radius;
        var sun = this.scene.lights[0];
        var moon = this.scene.lights[1];

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
        this.scene.setActiveShader(this.shaders[this.scene.cloudMode]);

        this.shaders[this.scene.cloudMode].setUniformsValues({
            uSampler2: 1,
            timeFactor: this.timeFactor,
            cloudScale: 4.0,
            cloudscale: this.scene.cloudScale,
            clouddark: this.scene.cloudDark,
            cloudlight: this.scene.cloudLight,
            cloudcover: this.scene.cloudCover,
            cloudalpha: this.scene.cloudAlpha,
            skytint: this.scene.skyTint,
            skycolour1: this.scene.hexToRGB(
                this.scene.cloudColors["SkyColour1"],
            ),
            skycolour2: this.scene.hexToRGB(
                this.scene.cloudColors["SkyColour2"],
            ),
            nightcolour1: this.scene.hexToRGB(
                this.scene.cloudColors["nightColour1"],
            ),
            nightcolour2: this.scene.hexToRGB(
                this.scene.cloudColors["nightColour2"],
            ),
            sunangle: this.timeOfDay,
            dayfactor: this.dayFactor,
        });

        if (this.scene.cloudMode == 0) {
            this.scene.translate(0, this.yPosition, 0);
            this.scene.rotate(Math.PI / 2, 1, 0, 0);
            this.scene.scale(this.scale, this.scale, this.scale);
            this.quad.display();
        } else {
            this.scene.translate(0, this.yPosition - 4 - 5, 0);
            this.scene.rotate(-Math.PI / 2, 1, 0, 0);
            this.scene.scale(0.99, 0.99, 0.99);
            this.sphere.display();
        }
        this.scene.setActiveShader(this.scene.defaultShader);
        this.scene.popMatrix();
        this.scene.defaultMaterial.apply();
    }
}
