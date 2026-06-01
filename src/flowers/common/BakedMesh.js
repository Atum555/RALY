import { CGFobject } from "../../lib/CGF.js";

// A static triangle mesh built from vertices/normals/indices already baked into
// a common local space. The flower field collapses each prototype's whole
// L-system into a handful of these (one per material) so a flower instance
// costs a couple of GL draws instead of replaying the L-system every frame.
//
// The group's flat colour is baked in as a per-vertex attribute (aVertexColor)
// rather than set as a uniform before each draw: every vertex of a group shares
// one colour, but carrying it on the mesh lets the field draw thousands of
// flowers without a setUniformsValues call per group -- that call re-binds the
// program and walks every uniform the shader declares, so per-draw it dominated
// the frame. With the colour on the vertex it is uploaded once, at bake time.
export class BakedMesh extends CGFobject {
    constructor(scene, vertices, normals, indices, color) {
        super(scene);
        this.vertices = vertices;
        this.normals = normals;
        this.indices = indices;
        this.primitiveType = scene.gl.TRIANGLES;
        this.initGLBuffers();

        // Per-vertex colour buffer: the group's single flat colour repeated for
        // every vertex. Bound to aVertexColor in display() when the active shader
        // declares it (the main flower shader does; the depth shader does not).
        if (color) {
            const gl = scene.gl;
            const n = this.vertices.length / 3;
            const cols = new Float32Array(n * 3);
            for (let i = 0; i < n; i++) {
                cols[i * 3] = color[0];
                cols[i * 3 + 1] = color[1];
                cols[i * 3 + 2] = color[2];
            }
            this.colorsBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, this.colorsBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, cols, gl.STATIC_DRAW);
        }
    }

    display() {
        const gl = this.scene.gl;
        const shader = this.scene.activeShader;

        // Bind the baked colour to aVertexColor, if the active shader has it. The
        // location is queried once per shader and cached on it (-1 if absent, e.g.
        // the depth pass / normal-viz shader, in which case the colour is skipped).
        let loc = -1;
        if (this.colorsBuffer && shader) {
            loc = shader._aVertexColorLoc;
            if (loc === undefined) {
                loc = gl.getAttribLocation(shader.program, "aVertexColor");
                shader._aVertexColorLoc = loc;
            }
            if (loc >= 0) {
                gl.enableVertexAttribArray(loc);
                gl.bindBuffer(gl.ARRAY_BUFFER, this.colorsBuffer);
                gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0);
            }
        }

        super.display();

        // The generic attrib array is global GL state shared with other geometry,
        // so leave it as we found it.
        if (loc >= 0) gl.disableVertexAttribArray(loc);
    }
}
