// Box Generator for the Endless Marble Run
// https://github.com/Nurgak/Endless-Marble-Run
// License: MIT

const jscad = require('@jscad/modeling')
const { sphere, cuboid, circle, cylinder, roundedCuboid, cylinderElliptic } = jscad.primitives
const { extrudeRotate } = jscad.extrusions
const { translate, rotate } = jscad.transforms
const { subtract } = jscad.booleans

class Box {
  #model;
  static #grooveRadius = 1 / 5;
  static #curveSegments = 32;
  static #boxChamfer = 1 / 50;
  static #boxSegments = 4;

  constructor(base = "Full", top = "None", middle = "None", bottom = "None") {
    if (base == "Half") {
      this.#model = translate(
        [0, 0, -1 / 4],
        roundedCuboid({
          size: [1, 1, 1 / 2],
          roundRadius: Box.#boxChamfer,
          segments: Box.#boxSegments
        })
      );
    } else if (base == "Diagonal") {
      this.#model = subtract(
        roundedCuboid({
          size: [1, 1, 1],
          roundRadius: Box.#boxChamfer,
          segments: Box.#boxSegments
        }),
        translate(
          [1 / 2, 0, 1 / 2],
          rotate(
            [0, Math.PI / 4, 0],
            cuboid({
              size: [Math.sqrt(2), 1, Math.sqrt(2)]
            })
          )
        )
      );
    } else {
      this.#model = roundedCuboid({
        size: [1, 1, 1],
        roundRadius: Box.#boxChamfer,
        segments: Box.#boxSegments
      });
    }

    const topFunc = Box.type2Func[top];
    const middleFunc = Box.type2Func[middle];
    const bottomFunc = Box.type2Func[bottom];

    if (topFunc) {
      this.#model = subtract(this.#model, translate([0, 0, 1 / 2], topFunc()));
    }
    if (middleFunc) {
      this.#model = subtract(this.#model, middleFunc());
    }
    if (bottomFunc) {
      this.#model = subtract(this.#model, translate([0, 0, -1 / 2], bottomFunc()));
    }
  }

  getModel() {
    return this.#model;
  }

  static type2Func = {
    "None": null,
    "Straight A": Box.straightA,
    "Straight B": Box.straightB,
    "Turn A": Box.turnA,
    "Turn B": Box.turnB,
    "Turn C": Box.turnC,
    "Turn D": Box.turnD,
    "Turn 3 Way": Box.turnThreeWay,
    "Funnel": Box.funnel,
    "Cross": Box.cross,
    "Cross Hole": Box.crossHole,
    "Vertical Hole": Box.vertical,
    "Ramp A": Box.rampA,
    "Ramp B": Box.rampB,
    "Through Ramp A": Box.throughRampA,
    "Through Ramp B": Box.throughRampB,
    "Open Ramp A": Box.openRampA,
    "Open Ramp B": Box.openRampB,
    "End": Box.end,
  }

  static #holeChamfer() {
    return rotate(
      [-Math.PI / 2, 0, 0],
      cylinderElliptic({
        height: Box.#boxChamfer,
        startRadius: [Box.#grooveRadius, Box.#grooveRadius],
        endRadius: [Box.#grooveRadius + Box.#boxChamfer, Box.#grooveRadius + Box.#boxChamfer],
        center: [0, 0, 1 / 2 - Box.#boxChamfer / 2],
        segments: Box.#curveSegments
      })
    );
  }

  static straightA() {
    return [
      rotate(
        [Math.PI / 2, 0, 0],
        cylinder({
          radius: Box.#grooveRadius,
          height: 1,
          segments: Box.#curveSegments
        })
      ),
      Box.#holeChamfer(),
      rotate([0, 0, Math.PI], Box.#holeChamfer())
    ];
  }

  static straightB() {
    return rotate([0, 0, Math.PI / 2], Box.straightA());
  }

  static cross() {
    return [Box.straightA(), Box.straightB()]
  }

  static turnA() {
    return [
      translate(
        [1 / 2, 1 / 2, 0],
        extrudeRotate(
          {
            startAngle: Math.PI,
            angle: Math.PI / 2,
            overflow: 'cap',
            segments: Box.#curveSegments
          },
          circle({
            radius: Box.#grooveRadius,
            center: [1 / 2, 0],
            segments: Box.#curveSegments
          })
        )
      ),
      Box.#holeChamfer(),
      rotate([0, 0, -Math.PI / 2], Box.#holeChamfer())
    ];
  }

  static turnB() {
    return rotate(
      [0, 0, Math.PI / 2],
      Box.turnA()
    );
  }

  static turnC() {
    return rotate(
      [0, 0, Math.PI / 2],
      Box.turnB()
    );
  }

  static turnD() {
    return rotate(
      [0, 0, Math.PI / 2],
      Box.turnC()
    );
  }

  static turnThreeWay() {
    return [
      rotate(
        [0, 0, -Math.PI / 2],
        Box.turnA()
      ),
      rotate(
        [0, 0, Math.PI],
        Box.turnA()
      )
    ];
  }

  static funnel() {
    const depth = 1 / 2 - Box.#grooveRadius;
    return [
      cylinderElliptic({
        height: depth,
        startRadius: [Box.#grooveRadius, Box.#grooveRadius],
        endRadius: [1 / 2, 1 / 2],
        center: [0, 0, -depth / 2],
        segments: Box.#curveSegments
      }),
      cylinder({
        height: 1 / 3,
        radius: Box.#grooveRadius,
        center: [0, 0, - 1 / 6],
        segments: Box.#curveSegments
      })
    ];
  }

  static crossHole() {
    const edge = rotate(
      [0, Math.PI / 2, 0],
      translate(
        [1 / 4, 1 / 4, 0],
        extrudeRotate({
          startAngle: Math.PI,
          angle: Math.PI / 2,
          overflow: 'cap',
          segments: Box.#curveSegments
        },
        circle({
          radius: Box.#grooveRadius,
          center: [1 / 4, 0],
          segments: Box.#curveSegments
        }))
      )
    );

    const verticalDepth = 1 / 2;
    return [
      Box.cross(),
      edge,
      rotate([0, 0, Math.PI / 2], edge),
      rotate([0, 0, Math.PI], edge),
      rotate([0, 0, -Math.PI / 2], edge),
      cylinder({
        height: verticalDepth,
        radius: Box.#grooveRadius,
        center: [0, 0, -verticalDepth / 2],
        segments: Box.#curveSegments
      })
    ];
  }

  static vertical() {
    return [
      cylinder({
        height: 1 / 3,
        radius: Box.#grooveRadius,
        center: [0, 0, 0],
        segments: Box.#curveSegments
      })
    ];
  }

  static #exit() {
    return [
      sphere({
        radius: Box.#grooveRadius,
        segments: Box.#curveSegments
      }),
      rotate(
        [Math.PI / 2, 0, 0],
        cylinder({
          height: 1 / 2,
          radius: Box.#grooveRadius,
          center: [0, 0, -1 / 4],
          segments: Box.#curveSegments
        })
      )
    ];
  }

  static rampA() {
    return [
      ...Box.#exit(),
      cylinder({
        height: 1 / 6,
        radius: Box.#grooveRadius,
        center: [0, 0, 1 / 12],
        segments: Box.#curveSegments
      }),
      Box.#holeChamfer()
    ];
  }

  static rampB() {
    return [
      translate(
        [0, 0, 1 / 4],
        Box.#exit(),
        Box.#holeChamfer()
      ),
      cylinder({
        height: 1 / 6,
        radius: Box.#grooveRadius,
        center: [0, 0, 1 / 12 + 1 / 4],
        segments: Box.#curveSegments
      })
    ];
  }

  static throughRampA() {
    return [
      translate(
        [0, 1 / 2, Box.#grooveRadius + 1 / 30],
        rotate(
          [Math.PI / 2.35, 0, 0],
          cylinder({
            height: 2,
            radius: Box.#grooveRadius,
            center: [0, 0, 1 / 3],
            segments: Box.#curveSegments
          })
        )
      )
    ];
  }

  static throughRampB() {
    return [
      translate(
        [0, 1 / 8, 1 / 5],
        rotate(
          [Math.PI / 4, 0, 0],
          cylinder({
            height: 2,
            radius: Box.#grooveRadius,
            center: [0, 0, 0],
            segments: Box.#curveSegments
          })
        )
      )
    ];
  }

  static openRampA() {
    const offset = 1 / 10;
    const rampRadius = 1 - Box.#grooveRadius + offset;
    return [
      rotate(
        [Math.PI / 2, 0, Math.PI / 2],
        translate(
          [1 / 2, 1 - Box.#grooveRadius + offset, 0],
          extrudeRotate({
            startAngle: 0,
            angle: 2 * Math.PI,
            overflow: 'cap',
            segments: Box.#curveSegments
          },
          circle({
            radius: Box.#grooveRadius,
            center: [rampRadius, 0],
            segments: Box.#curveSegments
          }))
        )
      ),
      translate(
        [0, 1 / 2, 1 - Box.#grooveRadius + offset],
        rotate(
          [Math.PI / 2, 0, Math.PI / 2],
          cylinder({
            radius: rampRadius,
            height: 2 * Box.#grooveRadius,
            segments: Box.#curveSegments
          })
        )
      )
    ];
  }

  static openRampB() {
    const rampRadius = 1 - Box.#grooveRadius - 1 / 20;
    return [
      rotate(
        [Math.PI / 2, 0, Math.PI / 2],
        translate(
          [1 / 2, 1 / 2, 0],
          extrudeRotate({
            startAngle: 0,
            angle: 2 * Math.PI,
            overflow: 'cap',
            segments: Box.#curveSegments
          },
          circle({
            radius: Box.#grooveRadius,
            center: [rampRadius, 0],
            segments: Box.#curveSegments
          }))
        )
      ),
      translate(
        [0, 1 / 2, 1 / 2],
        rotate(
          [Math.PI / 2, 0, Math.PI / 2],
          cylinder({
            radius: rampRadius,
            height: 2 * Box.#grooveRadius,
            segments: Box.#curveSegments
          })
        )
      )
    ];
  }

  static end() {
    const holeDepth = 1 / 2 + 2.2 / 5;
    return cylinder({
      height: holeDepth,
      radius: 3.7 / 5 / 2,
      center: [0, 0, 1 - holeDepth / 2],
      segments: Box.#curveSegments
    });
  }
}

const main = (params) => {
  if (params.display == "All") {
    const all = [
      new Box("Full", "Straight A", "Straight A", "None"),
      new Box("Full", "Turn A", "Straight A", "None"),
      new Box("Full", "Turn B", "Straight A", "None"),
      new Box("Full", "Cross", "Straight A", "None"),
      new Box("Full", "Cross Hole", "Ramp A", "None"),
      new Box("Full", "Cross Hole", "Vertical Hole", "Ramp B"),
      new Box("Full", "Funnel", "Ramp A", "None"),
      new Box("Full", "Funnel", "Vertical Hole", "Ramp B"),
      new Box("Full", "Cross Hole", "Straight B", "Through Ramp A"),
      new Box("Full", "Turn 3 Way", "Open Ramp A", "None"),
      new Box("Full", "Turn 3 Way", "Open Ramp B", "None"),
      new Box("Full", "Straight A", "Through Ramp B", "None"),
      new Box("Half", "None", "Straight A", "None"),
      new Box("Half", "None", "Turn A", "None"),
      new Box("Half", "None", "Cross", "None"),
    ];
    let translated = []
    const step = 2;
    const grid = Math.ceil(Math.sqrt(all.length));
    const centerOffset = (grid - 1) * step / 2;
    let offset = -all.length - 1;
    for (let y = 0; y < grid; y++) {
      for (let x = 0; x < grid; x++) {
        if (all[y * grid + x]) {
          translated.push(translate([
            x * step - centerOffset,
            y * step - centerOffset,
            1 / 2], all[y * grid + x].getModel()));
        } else {
          break;
        }
      }
    }
    return translated;
  }

  const box = new Box(
    params.typeBase,
    params.typeTop,
    params.typeMiddle,
    params.typeBottom
  );
  return box.getModel();
}

const getParameterDefinitions = () => {
  return [
    {
      name: 'display',
      type: 'choice',
      caption: 'Display:',
      values: ['All', 'Custom'],
      initial: "All"
    },
    {
      name: 'customBoxGroup',
      type: 'group',
      caption: 'Custom box',
      initial: 'closed'
    },
    {
      name: 'typeBase',
      type: 'choice',
      caption: 'Base type:',
      values: ['Full', 'Half', "Diagonal"],
      initial: "Full"
    },
    {
      name: 'typeTop',
      type: 'choice',
      caption: 'Top type:',
      values: Object.keys(Box.type2Func),
      initial: "Cross"
    },
    {
      name: 'typeMiddle',
      type: 'choice',
      caption: 'Middle type:',
      values: Object.keys(Box.type2Func),
      initial: "Straight A"
    },
    {
      name: 'typeBottom',
      type: 'choice',
      caption: 'Bottom type:',
      values: Object.keys(Box.type2Func),
      initial: "None"
    },
  ];
}

module.exports = { main, getParameterDefinitions }
