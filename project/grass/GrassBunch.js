import { CGFGroup } from "../core/CGFGroup.js";
import { GrassBlade } from "./GrassBlade.js";

const BLADE_TYPES = [
    { height: 0.4, width: 0.08, depth: 0.04 },
    { height: 0.5, width: 0.10, depth: 0.05 },
    { height: 0.7, width: 0.18, depth: 0.09 },
    { height: 1.0, width: 0.14, depth: 0.07 },
    { height: 1.2, width: 0.22, depth: 0.11 },
];

const CLUSTER_TYPES = [
    { count: 3, bladeIndices: [0, 0, 1], radius: 0.06, slices: 3},
    { count: 4, bladeIndices: [0, 1, 1, 2], radius: 0.07, slices: 3},
    { count: 4, bladeIndices: [1, 2, 2, 3], radius: 0.08, slices: 3 },
    { count: 5, bladeIndices: [1, 2, 3, 3, 4], radius: 0.08, slices: 3 },
    { count: 6, bladeIndices: [0, 1, 2, 3, 4, 4], radius: 0.09, slices: 3 },
];

export class GrassBunch extends CGFGroup {
    constructor(scene, typeIndex) {
        super(scene);
        let cluster = CLUSTER_TYPES[typeIndex % CLUSTER_TYPES.length];
        let angleOffset = Math.random() * Math.PI * 2;
        this.blades = [];

        for (let bladeIdx = 0; bladeIdx < cluster.count; bladeIdx++) {
            let bladeType = BLADE_TYPES[cluster.bladeIndices[bladeIdx % cluster.bladeIndices.length]];
            let height = bladeType.height + (Math.random() - 0.5) * bladeType.height * 0.2;

            let angle = angleOffset + (bladeIdx / cluster.count) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
            let radius = cluster.radius + (Math.random() - 0.5) * 0.02;

            let blade = this.addPart(new GrassBlade(
                scene, cluster.slices, height, bladeType.width, bladeType.depth,
                (Math.random() - 0.5) * height * 0.35,
                (Math.random() - 0.5) * height * 0.15,
            ));
            this.blades.push({ obj: blade, x: Math.cos(angle) * radius, z: Math.sin(angle) * radius });
        }
    }

    display() {
        for (let blade of this.blades) {
            this.scene.pushMatrix();
            this.scene.translate(blade.x, 0, blade.z);
            blade.obj.display();
            this.scene.popMatrix();
        }
    }
}
