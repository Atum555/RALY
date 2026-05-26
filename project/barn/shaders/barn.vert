attribute vec3 aVertexPosition;
attribute vec3 aVertexNormal;
attribute vec2 aTextureCoord;

uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;
uniform mat4 uNMatrix;

varying vec2 vTextureCoord;
varying vec3 vNormal;

uniform float normScale;

void main() {
	vTextureCoord = aTextureCoord;
	vNormal = aVertexNormal;
	
	gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);
}
