import { CGFobject } from "../lib/CGF.js";
import { MyFlower } from "./MyFlower.js";

export class MyFlowerPatch extends CGFobject {
    constructor(scene, numFlowers, patchSizeX, patchSizeZ) {
        super(scene);

        this.numFlowers = Number.isInteger(numFlowers) && numFlowers > 0 ? numFlowers : 12;
        this.patchSizeX = typeof patchSizeX === "number" ? patchSizeX : 4.0;
        this.patchSizeZ = typeof patchSizeZ === "number" ? patchSizeZ : 4.0;

        this.flowers = [];
        // Scatter system: Instantiates multiple MyFlower objects with random global scale, Y-axis rotation, and X/Z offsets for natural randomness.

        for (let flowerIndex = 0; flowerIndex < this.numFlowers; flowerIndex += 1) {
            const flower = new MyFlower(
                scene,
                this.randomRange(0.10, 0.18),
                this.randomRange(0.04, 0.08),
                this.randomRange(0.45, 0.95),
                this.randomRange(0.01, 0.025),
                this.randomInteger(5, 8),
                this.randomPetalColor(),
            );

            this.flowers.push({
                flower,
                offsetX: this.randomRange(-this.patchSizeX / 2, this.patchSizeX / 2),
                offsetZ: this.randomRange(-this.patchSizeZ / 2, this.patchSizeZ / 2),
                scaleFactor: this.randomRange(0.35, 0.7),
                rotationY: this.randomRange(0, 2 * Math.PI),
            });
        }
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
        const jitterAmount = 0.05;

        return [
            this.clamp01(selectedColor[0] + this.randomRange(-jitterAmount, jitterAmount)),
            this.clamp01(selectedColor[1] + this.randomRange(-jitterAmount, jitterAmount)),
            this.clamp01(selectedColor[2] + this.randomRange(-jitterAmount, jitterAmount)),
        ];
    }

    display() {
        for (let flowerIndex = 0; flowerIndex < this.flowers.length; flowerIndex += 1) {
            const flowerEntry = this.flowers[flowerIndex];

            this.scene.pushMatrix();
            this.scene.translate(flowerEntry.offsetX, 0, flowerEntry.offsetZ);
            this.scene.rotate(flowerEntry.rotationY, 0, 1, 0);
            this.scene.scale(flowerEntry.scaleFactor, flowerEntry.scaleFactor, flowerEntry.scaleFactor);
            flowerEntry.flower.display();
            this.scene.popMatrix();
        }
    }
}
