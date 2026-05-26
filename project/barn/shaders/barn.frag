#ifdef GL_ES
precision highp float;
#endif

varying vec2 vTextureCoord;
varying vec3 vNormal;

uniform sampler2D uSampler;
uniform sampler2D uSampler2;
uniform sampler2D uSampler3;
uniform sampler2D uSampler4;

void main() {
	vec4 mask = texture2D(uSampler4, vTextureCoord);

	vec4 color = texture2D(uSampler, vTextureCoord);

	if (mask.g > 0.8 && abs(vNormal.z) > 0.5) {
		vec4 doorColor = texture2D(uSampler2, vTextureCoord);
		color = doorColor;
	}

	if (mask.b > 0.8 && abs(vNormal.y) == 0.0) {
		vec4 windowColor = texture2D(uSampler3, vTextureCoord);
		color = windowColor;
	}

	if (mask.r > 0.8 && mask.g > 0.8 && mask.b > 0.8) {
		color = vec4(1.0);
	}

	gl_FragColor = color;
}
