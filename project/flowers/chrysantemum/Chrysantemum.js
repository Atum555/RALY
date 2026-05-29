import { LSystem } from "../common/LSystem.js";
import { Stem } from "../common/Stem.js";
import { Leaf } from "../tulip/Leaf.js";
import { Flower } from "./Flower.js";
import { hexToRGB } from "../../utils.js";

export class Chrysantemum extends LSystem {
    // =====================================================
    // Init
    // =====================================================

    constructor(scene) {
        super(scene);
        this.axiom = "F";
        this.angle = 20;
        this.iterations = 4;
        this.scaleFactor = 0.7;

        this.rose_colors = {
            flower_red: "#cc0033",
            flower_pink: "#ff6699",
            flower_white: "#fff0f0",
            flower_yellow: "#ffcc33",
            stem_light: "#3d7a1a",
            stem_dark: "#1f4d0a",
        };

        const flowerKeys = [
            "flower_red",
            "flower_pink",
            "flower_white",
            "flower_yellow",
        ];
        const stemKeys = ["stem_light", "stem_dark"];

        this.flowerColor = hexToRGB(
            this.rose_colors[
                flowerKeys[Math.floor(Math.random() * flowerKeys.length)]
            ],
            false,
        );
        this.stemColor = hexToRGB(
            this.rose_colors[
                stemKeys[Math.floor(Math.random() * stemKeys.length)]
            ],
            false,
        );

        this.init();
    }

    // =====================================================
    // Grammar
    // =====================================================

    iniGrammar() {
        this.grammar = [];
        this.primitives = [];

        this.grammar.push("S");
        this.primitives.push(
            this.addPart(new Stem(this.scene, 0.08, this.stemColor)),
        );
        this.grammar.push("L");
        this.primitives.push(
            this.addPart(new Leaf(this.scene, 1.0, this.stemColor, 4, 4)),
        );
        this.grammar.push("F");
        this.primitives.push(
            this.addPart(new Flower(this.scene, this.flowerColor)),
        );
    }

    // =====================================================
    // Productions
    // =====================================================
    initProductions() {
this.predecessor = ["F", "F", "F", "F", "F", "F", "F", "F", "F", "F", "F", "F", "F", "F"];

this.successor = [
    // branching rotations
    "S[-F][^F][&F]",
    "+S[+F][^F]",
    "-S[-F][&F]",
    "^S[+F][^F]",
    "&S[-F][^F][+F]",

    // Branching leaves
    "/LS[-F][&F]",
    "\\LS[+F][^F]",

    "/LSF",
    "+S[-F]",
    "/LS[+F]",
    "/LS[^F]",
    "\\LS[^F]",
    "&S[+F]",
    "/L^S[-F]",
];
    }
}
