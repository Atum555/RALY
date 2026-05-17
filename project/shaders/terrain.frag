#ifdef GL_ES
precision highp float;
#endif

varying vec2 vTextureCoord;

uniform sampler2D uSamplerGrass;
uniform sampler2D uSamplerDirt;
uniform sampler2D uSamplerMap;

void main() {
    vec4 grassColor = texture2D(uSamplerGrass, vTextureCoord);
    vec4 dirtColor = texture2D(uSamplerDirt, vTextureCoord);
    vec4 mapColor = texture2D(uSamplerMap, vTextureCoord);
    
    // Use the red channel of the splat map as blend factor
    // R = 0 -> grass, R = 1 -> dirt
    float blendFactor = mapColor.r;
    
    // Blend between grass and dirt using mix()
    gl_FragColor = mix(grassColor, dirtColor, blendFactor);
}
