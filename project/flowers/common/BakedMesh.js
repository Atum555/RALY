import { CGFobject } from "../../../lib/CGF.js";

// A static triangle mesh built from vertices/normals/indices already baked into
// a common local space. The flower field collapses each prototype's whole
// L-system into a handful of these (one per material) so a flower instance
// costs a couple of GL draws instead of replaying the L-system every frame.
export class BakedMesh extends CGFobject {
    constructor(scene, vertices, normals, indices) {
        super(scene);
        this.vertices = vertices;
        this.normals = normals;
        this.indices = indices;
        this.primitiveType = scene.gl.TRIANGLES;
        this.initGLBuffers();
    }

    display() {
        super.display();
    }
}
