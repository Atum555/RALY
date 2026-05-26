#ifdef GL_ES
precision highp float;
#endif

varying vec2 vTextureCoord;
varying vec3 vNormal;

uniform sampler2D uSampler;
uniform sampler2D uSampler2;
uniform sampler2D uSampler3;
uniform sampler2D uSampler4;
uniform vec3 uWoodTint;
uniform float uUseMask;

void main() {
	vec2 reducedvtex = vec2(vTextureCoord.x / 4.0, vTextureCoord.y);
	vec2 wrappedvtex = vec2(fract(vTextureCoord.x), vTextureCoord.y);

	vec4 color = texture2D(uSampler, wrappedvtex) * vec4(uWoodTint, 1.0);

	if (uUseMask > 0.5) {
		vec4 mask = texture2D(uSampler4, reducedvtex);

		if (mask.g > 0.8 && abs(vNormal.z) > 0.5) {
			vec4 doorColor = texture2D(uSampler2, reducedvtex);
			color = doorColor;
		}

		if (mask.b > 0.8 && abs(vNormal.y) == 0.0) {
			vec4 windowColor = texture2D(uSampler3, reducedvtex);
			color = windowColor;
		}

		if (mask.r > 0.8 && mask.g > 0.8 && mask.b > 0.8) {
			color = vec4(1.0);
		}
	}

	gl_FragColor = color;
}
