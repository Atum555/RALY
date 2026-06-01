import { BakedMesh } from "../flowers/common/BakedMesh.js";

// One scatter cell's worth of grass clumps merged into a single static mesh, so a
// whole cell of tufts costs one GL draw instead of one draw per clump. The merge
// is done in world space (GrassPatch.buildCell), which means the wind bend can no
// longer rely on the per-clump model matrix the old per-clump draw provided:
//
//   - aVertexPosition.xz is the blade's WORLD position (clump offset + yaw + scale
//     already baked in), and aVertexPosition.y is the blade's LOCAL height above
//     its own root (also scaled) -- the vertex shader needs that local height for
//     the wind amplitude and the root-darkening, and it would be lost if y carried
//     the terrain height instead.
//   - aBase carries the clump's terrain ground height, added back to the local
//     height in the shader to seat the blade on the ground.
//
// CGFobject only binds aVertexPosition/aVertexNormal, so this subclass uploads the
// extra per-vertex aBase buffer and binds it around the inherited draw.
export class GrassCellMesh extends BakedMesh {
    constructor(scene, vertices, normals, indices, baseHeights) {
        super(scene, vertices, normals, indices);
        this.baseHeights = baseHeights;

        const gl = scene.gl;
        this.baseBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.baseBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(baseHeights), gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }

    // Bind aBase (if the active shader declares it), then let the base class bind
    // position/normal and issue the draw. The base draw leaves our attribute array
    // bound through gl.drawElements, which is all that matters.
    drawElements(primitiveType) {
        const gl = this.scene.gl;
        const loc = this.scene.activeShader.attributes.aBase;
        const bound = loc !== undefined && loc !== -1;
        if (bound) {
            gl.enableVertexAttribArray(loc);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.baseBuffer);
            gl.vertexAttribPointer(loc, 1, gl.FLOAT, false, 0, 0);
        }
        super.drawElements(primitiveType);
        // Don't leave the array enabled: the next shader bound (the default shader,
        // the flower shader, ...) may not declare aBase, and a stale enabled array
        // pointing at this buffer would dangle once the cell is evicted.
        if (bound) gl.disableVertexAttribArray(loc);
    }

    // Free the GL buffers when the cell is evicted from the field's cache, so a
    // long drive over fresh ground doesn't leak a buffer per cell left behind.
    dispose() {
        const gl = this.scene.gl;
        gl.deleteBuffer(this.vertsBuffer);
        gl.deleteBuffer(this.normsBuffer);
        gl.deleteBuffer(this.indicesBuffer);
        gl.deleteBuffer(this.baseBuffer);
    }
}
