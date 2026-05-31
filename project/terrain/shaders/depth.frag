#ifdef GL_ES
precision highp float;
#endif

// Depth-only pass: the colour output is unused (the FBO has no colour
// attachment); the rasterizer writes gl_FragCoord.z into the cascade's depth
// texture automatically.
void main() {
    gl_FragColor = vec4(1.0);
}
