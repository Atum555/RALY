import { MyDiamond } from "./MyDiamond.js";

export class MyAnimatedObject
{
    constructor(scene, s=0, e=5, st=3, d=2)
    {
        this.scene=scene;
        this.obj=new MyDiamond(scene);

        this.startVal=s;
        this.endVal=e;
        this.animStartTimeSecs=st;
        this.animDurationSecs=d;
        this.length=(this.endVal-this.startVal);

        this.animVal=this.startVal;
    }

    tween(x)
    {
        // https://easings.net
        // https://easings.net/#easeInElastic
        const c4 = (2 * Math.PI) / 3;
        
        return x === 0
            ? 0
            : x === 1
            ? 1
            : -Math.pow(2, 10 * x - 10) * Math.sin((x * 10 - 10.75) * c4);        
    }

    update(timeSinceAppStart)
    {
      // Animation based on elapsed time since animation start
      var elapsedTimeSecs=timeSinceAppStart-this.animStartTimeSecs;

      if (elapsedTimeSecs>=0 && elapsedTimeSecs<=this.animDurationSecs)
          this.animVal=this.startVal +           (elapsedTimeSecs/this.animDurationSecs) * this.length;
          //this.animVal=this.startVal + this.tween(elapsedTimeSecs/this.animDurationSecs) * this.length;
    }

    display()
    {
        this.scene.pushMatrix();
        this.scene.translate(this.animVal,0,0);

        this.obj.display();

        this.scene.popMatrix();
    }
}