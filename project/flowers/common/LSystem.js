import { CGFGroup } from "../../core/CGFGroup.js";

export class LSystem extends CGFGroup {
    // =====================================================
    // Init
    // =====================================================

    constructor(scene) {
        super(scene);
    }

    init() {
        this.iterations = this.iterations || 3;
        this.radAngle = (this.angle || 25) * Math.PI / 180.0;
        this.scale = Math.pow(this.scaleFactor, this.iterations - 1);

        this.iniGrammar();
        this.initProductions();
        this.iterate();
    }

    // =====================================================
    // Grammar
    // =====================================================

    iniGrammar() {
        this.grammar = [];
        this.primitives = [];
    }

    // =====================================================
    // Productions
    // =====================================================

    initProductions() {
        this.predecessor = [];
        this.successor = [];
    }

    // =====================================================
    // Expand
    // =====================================================

    iterate() {
        let current = this.axiom;
        for (let i = 0; i < this.iterations; ++i) {
            let newString = "";
            for (let j = 0; j < current.length; ++j) {
                let productions = [];
                for (let p = 0; p < this.predecessor.length; ++p) {
                    if (current[j] == this.predecessor[p]) {
                        productions.push(p);
                    }
                }
                if (productions.length == 0) {
                    newString += current[j];
                } else if (productions.length == 1) {
                    newString += this.successor[productions[0]];
                } else {
                    newString += this.successor[Math.floor(Math.random() * productions.length)];
                }
            }
            current = newString;
        }
        this.expandedAxiom = current;
    }

    // =====================================================
    // Display
    // =====================================================

    display() {
        for (let i = 0; i < this.expandedAxiom.length; ++i) {
            switch (this.expandedAxiom[i]) {
                case "+":
                    this.scene.rotate(this.radAngle, 0, 0, 1);
                    break;
                case "-":
                    this.scene.rotate(-this.radAngle, 0, 0, 1);
                    break;
                case "\\":
                    this.scene.rotate(this.radAngle * 10, 0, 1, 0);
                    break;
                case "/":
                    this.scene.rotate(-this.radAngle * 10, 0, 1, 0);
                    break;
                case "^":
                    this.scene.rotate(this.radAngle, 1, 0, 0);
                    break;
                case "&":
                    this.scene.rotate(-this.radAngle, 1, 0, 0);
                    break;
                case "[":
                    this.scene.pushMatrix();
                    break;
                case "]":
                    this.scene.popMatrix();
                    break;
                default:
                    for (let j = 0; j < this.grammar.length; ++j) {
                        if (this.expandedAxiom[i] == this.grammar[j]) {
                            this.scene.pushMatrix();
                            this.scene.scale(this.scale, this.scale, this.scale);
                            this.primitives[j].setDefaultAppearance();
                            this.primitives[j].display();
                            this.scene.popMatrix();
                            if(this.expandedAxiom[i] != "L")
                                this.scene.translate(0, this.scale, 0);
                            break;
                        }
                    }
                    break;
            }
        }
    }
}
