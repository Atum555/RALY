import { LSystem } from "../common/LSystem.js";
import { Stem } from "../common/Stem.js";
import { Leaf } from "./Leaf.js";
import { Flower } from "./Flower.js";
import { hexToRGB } from "../../utils.js";

export class Tulip extends LSystem {
    // =====================================================
    // Init
    // =====================================================

    constructor(scene) {
        super(scene);
        this.axiom = "SWF";
        this.angle = 12;
        this.iterations = 4;
        this.scaleFactor = 0.6;

        this.tulip_colors = {
            flower_red: "#e63333",
            flower_purple: "#9933cc",
            flower_white: "#f2f2f2",
            flower_orange: "#ff9911",
            flower_pink: "#ff66b3",
            stem_light: "#4d9933",
            stem_dark: "#266619",
        };

        const flowerKeys = ["flower_red", "flower_purple", "flower_white", "flower_orange", "flower_pink"];
        const stemKeys = ["stem_light", "stem_dark"];

        this.flowerColor = hexToRGB(this.tulip_colors[flowerKeys[Math.floor(Math.random() * flowerKeys.length)]], false);
        this.stemColor = hexToRGB(this.tulip_colors[stemKeys[Math.floor(Math.random() * stemKeys.length)]], false);

        this.init();
    }

    // =====================================================
    // Grammar
    // =====================================================

    iniGrammar() {
        this.grammar = [];
        this.primitives = [];

        this.grammar.push("S");
        this.primitives.push(this.addPart(new Stem(this.scene, 0.12, this.stemColor)));
        this.grammar.push("L");
        this.primitives.push(this.addPart(new Leaf(this.scene, 3, this.stemColor, 4, 4)));
        this.grammar.push("F");
        this.primitives.push(this.addPart(new Flower(this.scene, this.flowerColor)));
    }

    // =====================================================
    // Productions
    // =====================================================

    initProductions() {
        this.predecessor = ["S", "S", "S", "S", "S", "S", "S", "S", "W", "W"];
        this.successor =    ["S", "+S", "-S", "/LS", "\\LS", "SW", "+SW", "/LSW", "S", "SW"];
    }
}
