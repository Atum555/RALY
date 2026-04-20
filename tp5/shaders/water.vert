attribute vec3 aVertexPosition;
attribute vec3 aVertexNormal;
attribute vec2 aTextureCoord;

uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;
uniform mat4 uNMatrix;
uniform float timeFactor;

varying vec2 vTextureCoord;
uniform sampler2D waterMap;

uniform float normScale;


void main() {
    vec3 offset=vec3(0.0,0.0,0.0);
	gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);

	vTextureCoord = aTextureCoord;

    vec4 tex = texture2D(waterMap, vec2(timeFactor * 0.01,timeFactor * 0.01)+vTextureCoord);
    float colours = 0.33 * tex.b + 0.33 * tex.r + 0.33 * tex.g; 
    offset=aVertexNormal*normScale*colours * 0.07;


    gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition + offset, 1.0);
}

