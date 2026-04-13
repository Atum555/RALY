#ifdef GL_ES
precision highp float;
#endif

varying vec4 coords;
varying vec4 normal;
varying vec4 pos;

void main() {
	gl_FragColor.a =  1.0;
	if (pos.y > 0.5){

        gl_FragColor.r = 1.0;
        gl_FragColor.g = 1.0;
    }
	else
	{
		gl_FragColor.b = 1.0;
	}
}