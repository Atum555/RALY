import { CGFobject, CGFappearance, CGFtexture } from "../../lib/CGF.js";
import { HayBale } from "./HayBale.js";
import { Rock } from "./Rock.js";
import { Tree } from "./Tree.js";

export class ObstacleScene extends CGFobject {
    constructor(scene) {
        super(scene);
        this.haybale = new HayBale(scene);
        this.rock = new Rock(scene);
        this.tree = new Tree(scene);

        this.haybaleMaterial = new CGFappearance(this.scene);
        this.haybaleMaterial.setAmbient(0.3, 0.3, 0.3, 1);
        this.haybaleMaterial.setDiffuse(0.8, 0.8, 0.8, 1);
        this.haybaleMaterial.setSpecular(0.1, 0.1, 0.1, 1);
        this.haybaleMaterial.setShininess(10.0);
        this.haybaleMaterial.loadTexture("obstacles/textures/haybale.jpg");
        this.haybaleMaterial.setTextureWrap("REPEAT", "REPEAT");
    }

    display() {
        this.scene.gl.texParameteri(
            this.scene.gl.TEXTURE_2D,
            this.scene.gl.TEXTURE_MAG_FILTER,
            this.scene.gl.NEAREST,
        );

        this.haybaleMaterial.apply();
        this.haybale.display();
    }

    enableNormalViz() {
        this.haybale.enableNormalViz();
    }

    disableNormalViz() {
        this.haybale.disableNormalViz();
    }
}
