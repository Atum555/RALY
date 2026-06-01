// Shadow depth pass: project terrain vertices into the sun's clip space. The
// scene swaps in the cascade's orthographic light camera (view + projection)
// before walking the quadtree, so the standard uMVMatrix/uPMatrix already carry
// the light transform. Only the position is needed -- depth is what we capture.
attribute vec3 aVertexPosition;

uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;

void main() {
    gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);
}
