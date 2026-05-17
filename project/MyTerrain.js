import { CGFobject, CGFshader, CGFtexture } from "../lib/CGF.js";
import { MyPlane } from "./sky/MyPlane.js";

export class MyTerrain extends CGFobject {
    constructor(scene) {
        super(scene);

        this.plane = new MyPlane(scene, 20);
        // Multi-texturing shader: Blends Grass (Unit 0) and Dirt (Unit 1) based on the Red channel of the Splat Map (Unit 2).
        // Note: Vertex displacement (heightmap) logic will be injected here in a future sprint.
        this.shader = new CGFshader(
            scene.gl,
            "shaders/terrain.vert",
            "shaders/terrain.frag",
        );

        this.grassTexture = new CGFtexture(scene, "images/grass.jpg");
        this.dirtTexture = new CGFtexture(scene, "images/dirt.jpg");
        this.splatMap = new CGFtexture(scene, "images/altmap.png");

        this.shader.setUniformsValues({
            uSamplerGrass: 0,
            uSamplerDirt: 1,
            uSamplerMap: 2,
        });
    }

    display() {
        this.scene.setActiveShader(this.shader);
        this.grassTexture.bind(0);
        this.dirtTexture.bind(1);
        this.splatMap.bind(2);

        this.shader.setUniformsValues({
            uSamplerGrass: 0,
            uSamplerDirt: 1,
            uSamplerMap: 2,
        });

        this.plane.display();
        this.scene.setActiveShader(this.scene.defaultShader);
    }
}
