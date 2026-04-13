#ifdef GL_ES
precision highp float;
#endif

varying vec2 vTextureCoord;

uniform sampler2D uSampler;
uniform sampler2D waterMap;
uniform sampler2D water;

void main() {
	vec4 color = texture2D(water, vTextureCoord);
	vec4 map = texture2D(waterMap, vec2(0.0,0.1)+vTextureCoord);

	
	
	gl_FragColor = color;
}