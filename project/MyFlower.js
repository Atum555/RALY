import { CGFappearance, CGFobject } from "../lib/CGF.js";
import { MyCylinder } from "./MyCylinder.js";
import { MyQuad } from "./MyQuad.js";

export class MyFlower extends CGFobject {
    constructor(
        scene,
        petalRadius,
        centerRadius,
        stemHeight,
        stemRadius,
        numPetals,
        petalColor,
    ) {
        super(scene);

        this.petalRadius = typeof petalRadius === "number" ? petalRadius : this.randomRange(0.10, 0.18);
        this.centerRadius = typeof centerRadius === "number" ? centerRadius : this.randomRange(0.04, 0.08);
        this.stemHeight = typeof stemHeight === "number" ? stemHeight : this.randomRange(0.45, 0.95);
        this.stemRadius = typeof stemRadius === "number" ? stemRadius : this.randomRange(0.01, 0.025);
        this.numPetals = Number.isInteger(numPetals) && numPetals > 0 ? numPetals : this.randomInteger(5, 8);

        this.petalColor = this.normalizeColor(petalColor) || this.randomPetalColor();

        this.stem = new MyCylinder(scene, 12, 1);
        this.center = new MyCylinder(scene, 16, 1);
        this.petal = new MyQuad(scene);

        this.centerHeight = this.centerRadius * 0.8;
        this.petalWidth = this.petalRadius * 0.45;
        this.petalLength = this.petalRadius * this.randomRange(1.15, 1.55);
        this.petalOffset = this.centerRadius * 0.9;
        this.petalTilt = this.randomRange(0.18, 0.42);

        this.stemMaterial = new CGFappearance(scene);
        this.stemMaterial.setAmbient(0.08, 0.2, 0.08, 1);
        this.stemMaterial.setDiffuse(0.18, 0.5, 0.18, 1);
        this.stemMaterial.setSpecular(0.03, 0.05, 0.03, 1);
        this.stemMaterial.setShininess(6.0);

        this.centerMaterial = new CGFappearance(scene);
        this.centerMaterial.setAmbient(0.25, 0.18, 0.05, 1);
        this.centerMaterial.setDiffuse(0.7, 0.56, 0.18, 1);
        this.centerMaterial.setSpecular(0.08, 0.06, 0.02, 1);
        this.centerMaterial.setShininess(12.0);

        this.petalMaterial = new CGFappearance(scene);
        this.applyColorAppearance(this.petalMaterial, this.petalColor, 18.0);
    }

    randomRange(minimumValue, maximumValue) {
        return minimumValue + Math.random() * (maximumValue - minimumValue);
    }

    randomInteger(minimumValue, maximumValue) {
        return Math.floor(this.randomRange(minimumValue, maximumValue + 1));
    }

    clamp01(value) {
        return Math.max(0, Math.min(1, value));
    }

    normalizeColor(colorValue) {
        if (Array.isArray(colorValue) && (colorValue.length === 3 || colorValue.length === 4)) {
            return [
                this.clamp01(colorValue[0]),
                this.clamp01(colorValue[1]),
                this.clamp01(colorValue[2]),
            ];
        }

        if (colorValue && typeof colorValue === "object") {
            const hasRed = typeof colorValue.r === "number";
            const hasGreen = typeof colorValue.g === "number";
            const hasBlue = typeof colorValue.b === "number";
            if (hasRed && hasGreen && hasBlue) {
                return [
                    this.clamp01(colorValue.r),
                    this.clamp01(colorValue.g),
                    this.clamp01(colorValue.b),
                ];
            }
        }

        return null;
    }

    applyColorAppearance(appearance, color, shininessValue) {
        const red = this.clamp01(color[0]);
        const green = this.clamp01(color[1]);
        const blue = this.clamp01(color[2]);

        appearance.setAmbient(red * 0.35, green * 0.35, blue * 0.35, 1);
        appearance.setDiffuse(red, green, blue, 1);
        appearance.setSpecular(0.18, 0.18, 0.18, 1);
        appearance.setShininess(shininessValue);
    }

    randomPetalColor() {
        const palette = [
            [1.0, 1.0, 0.96],
            [1.0, 0.9, 0.35],
            [1.0, 0.72, 0.82],
            [0.95, 0.45, 0.52],
            [0.77, 0.5, 0.9],
            [0.98, 0.62, 0.3],
        ];

        const selectedColor = palette[this.randomInteger(0, palette.length - 1)];
        const colorJitter = 0.05;

        return [
            this.clamp01(selectedColor[0] + this.randomRange(-colorJitter, colorJitter)),
            this.clamp01(selectedColor[1] + this.randomRange(-colorJitter, colorJitter)),
            this.clamp01(selectedColor[2] + this.randomRange(-colorJitter, colorJitter)),
        ];
    }

    display() {
        const stemScale = [this.stemRadius, this.stemRadius, this.stemHeight];
        const centerScale = [this.centerRadius, this.centerRadius, this.centerHeight];

        this.stemMaterial.apply();
        this.scene.pushMatrix();
        this.scene.rotate(-Math.PI / 2, 1, 0, 0);
        this.scene.scale(stemScale[0], stemScale[1], stemScale[2]);
        this.stem.display();
        this.scene.popMatrix();

        this.centerMaterial.apply();
        this.scene.pushMatrix();
        this.scene.translate(0, this.stemHeight, 0);
        this.scene.rotate(-Math.PI / 2, 1, 0, 0);
        this.scene.scale(centerScale[0], centerScale[1], centerScale[2]);
        this.center.display();
        this.scene.popMatrix();

        const petalBaseHeight = this.stemHeight + this.centerHeight * 0.45;
        const angleStep = (2 * Math.PI) / this.numPetals;

        this.petalMaterial.apply();
        // Procedural geometry: Stem and center use MyCylinder. Petals use MyQuad.
        // Petal distribution uses basic polar coordinates (cos/sin) rotated around the Y-axis to form a circular shape.
        for (let petalIndex = 0; petalIndex < this.numPetals; petalIndex += 1) {
            const currentAngle = petalIndex * angleStep;

            this.scene.pushMatrix();
            this.scene.translate(0, petalBaseHeight, 0);
            this.scene.rotate(currentAngle, 0, 1, 0);
            this.scene.rotate(-this.petalTilt, 1, 0, 0);
            this.scene.translate(this.petalOffset, 0, 0);
            this.scene.scale(this.petalWidth, this.petalLength, 1.0);
            this.petal.display();
            this.scene.popMatrix();
        }
    }
}
