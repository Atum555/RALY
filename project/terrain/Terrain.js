import { CGFobject, CGFshader, CGFtexture } from "../../lib/CGF.js";

export class Terrain extends CGFobject {
    constructor(scene, nrDivs = 20) {
        super(scene);

        this.nrDivs = nrDivs;
        this.initBuffers();

        // Multi-texturing shader: Blends Grass (Unit 0) and Dirt (Unit 1) based on the Red channel of the Splat Map (Unit 2).
        // Note: Vertex displacement (heightmap) logic will be injected here in a future sprint.
        this.shader = new CGFshader(
            scene.gl,
            "terrain/shaders/terrain.vert",
            "terrain/shaders/terrain.frag",
        );

        this.grassTexture = new CGFtexture(scene, "terrain/images/grass.jpg");
        this.dirtTexture = new CGFtexture(scene, "terrain/images/dirt.jpg");
        this.splatMap = new CGFtexture(scene, "terrain/images/altmap.png");

        this.shader.setUniformsValues({
            uSamplerGrass: 0,
            uSamplerDirt: 1,
            uSamplerMap: 2,
        });
    }

    initBuffers() {
        const patchLength = 1.0 / this.nrDivs;

        // Generate vertices, normals, and texCoords
        this.vertices = [];
        this.normals = [];
        this.texCoords = [];
        let yCoord = 0.5;
        for (let j = 0; j <= this.nrDivs; j++) {
            let xCoord = -0.5;
            for (let i = 0; i <= this.nrDivs; i++) {
                this.vertices.push(xCoord, yCoord, 0);
                this.normals.push(0, 0, 1);
                this.texCoords.push(i / this.nrDivs, j / this.nrDivs);
                xCoord += patchLength;
            }
            yCoord -= patchLength;
        }

        // Generating indices
        this.indices = [];
        let ind = 0;
        for (let j = 0; j < this.nrDivs; j++) {
            for (let i = 0; i <= this.nrDivs; i++) {
                this.indices.push(ind);
                this.indices.push(ind + this.nrDivs + 1);
                ind++;
            }
            if (j + 1 < this.nrDivs) {
                this.indices.push(ind + this.nrDivs);
                this.indices.push(ind);
            }
        }

        this.primitiveType = this.scene.gl.TRIANGLE_STRIP;
        this.initGLBuffers();
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

        super.display();
        this.scene.setActiveShader(this.scene.defaultShader);
    }
}
