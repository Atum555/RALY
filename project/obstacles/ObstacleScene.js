import {
    CGFobject,
    CGFappearance,
    CGFtexture,
    CGFshader,
} from "../../lib/CGF.js";
import { HayBale } from "./HayBale.js";
import { Rock } from "./Rock.js";

export class ObstacleScene extends CGFobject {
    constructor(scene) {
        super(scene);
        this.haybale = new HayBale(scene);
        this.rock = new Rock(scene,1,1.5);

        this.initMaterials();
    }

    initMaterials() {
        this.haybaleMaterial = new CGFappearance(this.scene);
        this.haybaleMaterial.setAmbient(0.3, 0.3, 0.3, 1);
        this.haybaleMaterial.setDiffuse(0.8, 0.8, 0.8, 1);
        this.haybaleMaterial.setSpecular(0.1, 0.1, 0.1, 1);
        this.haybaleMaterial.setShininess(10.0);
        this.haybaleMaterial.loadTexture("obstacles/textures/haybale.jpg");
        this.haybaleMaterial.setTextureWrap("REPEAT", "REPEAT");

        this.rockMaterial = new CGFappearance(this.scene);
        this.rockMaterial.setAmbient(0.5, 0.5, 0.5, 1);
        this.rockMaterial.setDiffuse(0.5, 0.5, 0.5, 1);
        this.rockMaterial.setSpecular(0.1, 0.1, 0.1, 1);
        this.rockMaterial.loadTexture("obstacles/textures/rock.jpg");
        this.rockMaterial.setTextureWrap("REPEAT", "REPEAT");
        this.rockMaterial.setShininess(10.0);
    }

    display() {
        this.scene.gl.texParameteri(
            this.scene.gl.TEXTURE_2D,
            this.scene.gl.TEXTURE_MAG_FILTER,
            this.scene.gl.NEAREST,
        );

        //this.haybaleMaterial.apply();
        //this.haybale.display();
        this.rockMaterial.apply();

        this.rock.display();
        this.scene.setActiveShader(this.scene.defaultShader);
    }

    enableNormalViz() {
        this.haybale.enableNormalViz();
        this.rock.enableNormalViz();
    }

    disableNormalViz() {
        this.haybale.disableNormalViz();
        this.rock.disableNormalViz();
    }
}
