// Endless Marble Run
// https://github.com/Nurgak/Endless-Marble-Run
// License: MIT

// Set debug to true to view collision information.
const debug = false;

let world;
let cam;

class Camera {
  #cam;
  #cameraAngle;
  #cameraAngleRotation;
  #camOffset;
  #target;
  #cameraPosition;
  #cameraHeading;
  #mode;
  static MODE_FOLLOW = 0;
  static MODE_BALL = 1;

  constructor(offset, rotationSpeed) {
    this.#cam = createCamera();
    this.#cameraAngle = 0;
    this.#cameraAngleRotation = rotationSpeed;
    this.#camOffset = offset;
    this.#mode = Camera.MODE_FOLLOW;
    this.setPerspective();
  }

  setTarget(target) {
    this.#target = target;
    if (this.#target) {
      this.#cameraPosition = target.pose.position.copy();
      this.#cameraHeading = target.velocity.copy();
    }
    return this;
  }

  setToggleMode() {
    if (this.#mode == Camera.MODE_FOLLOW) {
      this.#mode = Camera.MODE_BALL;
    } else {
      this.#mode = Camera.MODE_FOLLOW;
    }
    return this;
  }

  getMode() {
    return this.#mode;
  }

  setPerspective() {
    let near = 1;
    let far = 50;
    let fov = Math.PI / 4;
    if (this.#mode == Camera.MODE_BALL) {
      near = 0.01;
      far = 10;
      fov = Math.PI / 1.15;
    }
    perspective(fov, width / height, near, far);
    return this;
  }

  update() {
    if (!this.#target) {
      return;
    }

    if (this.#mode == Camera.MODE_FOLLOW) {
      this.#cameraAngle += this.#cameraAngleRotation;
      this.#cam.camera(
        this.#target.pose.position.x +
          this.#camOffset.x * Math.sin(this.#cameraAngle),
        this.#target.pose.position.y +
          this.#camOffset.y * Math.cos(this.#cameraAngle),
        this.#target.pose.position.z + this.#camOffset.z,
        this.#target.pose.position.x,
        this.#target.pose.position.y,
        this.#target.pose.position.z,
        0,
        0,
        -1
      );
    } else if (this.#mode == Camera.MODE_BALL) {
      this.#cameraPosition.lerp(this.#target.pose.position, 0.1);
      this.#cameraHeading.lerp(this.#target.velocity, 0.1);

      this.#cam.camera(
        this.#cameraPosition.x - this.#cameraHeading.x,
        this.#cameraPosition.y - this.#cameraHeading.y,
        this.#cameraPosition.z - this.#cameraHeading.z,
        this.#cameraPosition.x,
        this.#cameraPosition.y,
        this.#cameraPosition.z,
        0,
        0,
        -1
      );
    }
    return this;
  }
}

class World {
  #balls;
  #boxes;
  #exitList;
  #debug;

  constructor(initialBoxType, debug = false) {
    this.#balls = [];
    this.#boxes = [];
    this.#exitList = [];
    this.#debug = debug;
    this.createBox(initialBoxType);
  }

  addBall(x, y, z) {
    this.#balls.push(new Ball(createVector(x, y, z), 1).setDebug(this.#debug));
    return this;
  }

  createBox(boxType, anchorIndex) {
    const nextBox = new boxType(createVector(0, 0, 0), 0).setDebug(this.#debug);
    let nextExit = nextBox.anchors[0].exit;

    if (this.#boxes.length) {
      // Pick a scpecific or random way through the box.
      const nextAnchor =
        anchorIndex === undefined
          ? random(nextBox.anchors)
          : nextBox.anchors[anchorIndex];

      const lastPosition = this.#boxes.at(-1).pose.position;
      const lastAnchor = this.#exitList.at(-1);

      // If the last exit position is below 0 and next entrance is
      // less than the top of the block (1/2) then they are not compatible.
      if (lastAnchor.z < 0 && nextAnchor.enter.z < 1 / 2) {
        return this;
      }

      const offsetX = Math.round(lastPosition.x + lastAnchor.x * 2);
      const offsetY = Math.round(lastPosition.y + lastAnchor.y * 2);
      const offsetZ =
        Math.round((lastPosition.z + lastAnchor.z - nextAnchor.enter.z) * 2) /
        2;

      nextBox.pose.position = createVector(offsetX, offsetY, offsetZ);
      nextBox.pose.rotation.z =
        PI +
        createVector(nextAnchor.enter.x, nextAnchor.enter.y).angleBetween(
          createVector(lastAnchor.x, lastAnchor.y)
        );

      if (nextAnchor.exit) {
        nextExit = p5.Vector.rotateZ(nextAnchor.exit, nextBox.pose.rotation.z);
      }
    }

    let isOtherBoxBlocking = false;
    const exitOffsetX = nextExit
      ? Math.round(nextBox.pose.position.x + nextExit.x * 2)
      : null;
    const exitOffsetY = nextExit
      ? Math.round(nextBox.pose.position.y + nextExit.y * 2)
      : null;
    for (const other of this.#boxes) {
      // Check if another box already at the same position.
      if (
        Math.round(other.pose.position.x) ==
          Math.round(nextBox.pose.position.x) &&
        Math.round(other.pose.position.y) ==
          Math.round(nextBox.pose.position.y) &&
        other.pose.position.z - other.shape.size / 2 <
          nextBox.pose.position.z + nextBox.shape.size / 2
      ) {
        isOtherBoxBlocking = true;
        break;
      }

      // Check if another box blocks the exit.
      if (exitOffsetX !== null && exitOffsetY !== null) {
        if (
          Math.round(other.pose.position.x) == exitOffsetX &&
          Math.round(other.pose.position.y) == exitOffsetY &&
          other.pose.position.z - 1 / 2 <= nextBox.pose.position.z + nextExit.z
        ) {
          // FIXME: this does not with half blocks
          isOtherBoxBlocking = true;
          break;
        }
      }
    }

    if (!isOtherBoxBlocking) {
      this.#boxes.push(nextBox);
      this.#exitList.push(nextExit);
    } else if (this.#boxes.length > 2) {
      // Remove 2 boxes, as that allow to find a different path.
      this.#boxes.splice(this.#boxes.length - 2);
      this.#exitList.splice(this.#exitList.length - 2);
    }

    return this;
  }

  getBall(index) {
    return this.#balls[index];
  }

  generate(size, boxOptions) {
    if (!this.#exitList.at(-1)) {
      return this;
    }
    const newSize = this.#boxes.length + size;
    while (this.#boxes.length < newSize) {
      this.createBox(random(boxOptions));
    }
    return this;
  }

  simulate(options) {
    this.#balls.forEach(
      function (ball, i) {
        ball.applyForce(createVector(0, 0, options.gravityForce));

        ball.applyForce(
          p5.Vector.normalize(ball.velocity).mult(options.frictionForce)
        );

        let endReached = false;
        let freeFalling = true;
        for (const box of this.#boxes) {
          // Assume all end anchors are "null", test only first.
          if (ball.checkCollision(box) && !box.anchors[0].exit) {
            endReached |= true;
          }
          // Detect when a ball does not overlap with any of the boxes.
          const distToBox = ball.pose.position.distXY(box.pose.position);
          if (distToBox < Math.sqrt(0.5) + ball.shape.size) {
            freeFalling &= false;
          }
        }
        if (freeFalling) {
          console.warn(`Ball ${i} is free falling.`);
          noLoop();
        }
        if (!endReached) {
          ball.roll();
          // Acceleration force to prevent balls from stopping.
          if (ball.velocity.mag() < options.maxVelocity) {
            ball.applyForce(
              p5.Vector.normalize(ball.velocity).mult(options.pushForce)
            );
          }
        }
        for (const otherBall of this.#balls.slice(i + 1)) {
          ball.checkCollision(otherBall);
        }

        ball.update();
      }.bind(this)
    );
    return this;
  }

  infinitePath(boxOptions) {
    this.#balls.sort((a, b) => a.pose.position.z - b.pose.position.z);
    const topBallZ = this.#balls.at(-1)?.pose.position.z;
    const bottomBallZ = this.#balls.at(0)?.pose.position.z;
    if (topBallZ === undefined) {
      return this;
    }

    // Raise previous boxes.
    for (const i in this.#boxes) {
      const boxTop = this.#boxes[i].pose.position.z + this.#boxes[i].shape.size;
      if (boxTop > topBallZ + 2 && this.#boxes[i].velocity.z == 0) {
        for (let j = 0; j <= i; j++) {
          this.#boxes[j].velocity.z = random(0.05, 0.1);
        }
        break;
      }
    }

    // Delete previous boxes.
    this.#boxes = this.#boxes.filter(
      (box) => box.pose.position.z < topBallZ + 10
    );

    if (
      !this.#boxes.length ||
      this.#boxes.at(-1).pose.position.z > bottomBallZ - 2
    ) {
      this.generate(1, boxOptions);
    }
    return this;
  }

  display(balls = true, boxes = true) {
    if (boxes) {
      for (const box of this.#boxes) {
        box.update().display();
      }
    }
    if (balls) {
      for (const ball of this.#balls) {
        ball.display();
      }
    }
    return this;
  }
}

function setup() {
  const canvas = createCanvas(windowWidth, windowHeight, WEBGL);
  frameRate(60);
  noStroke();

  world = new World(FunnelRampA, debug).addBall(0.3, 0.2, 1);

  cam = new Camera(createVector(7, 7, 7), 0.001).setTarget(
    world.getBall(0)
  );

  canvas.mouseClicked((randomColor) => {
    cam.setToggleMode().setPerspective();
  });
}

function draw() {
  orbitControl();

  background(0);
  directionalLight(color(127), 0, 0, -1);
  ambientLight(127);

  const displayBalls = cam.getMode() != Camera.MODE_BALL;
  world
    .infinitePath([
      Straight,
      // CrossStraight,
      TurnStraightA,
      TurnStraightB,
      CrossRampA,
      // CrossRampB,
      CrossOpenRampA,
      // CrossOpenRampB,
      FunnelRampA,
      // FunnelRampB,
      // StraightRamp,
      // HalfCross,
      HalfStraight,
      HalfTurn,
      Diagonal,
      CrossCrossRamp,
      // End,
      // HalfEnd,
    ])
    .simulate({
      gravityForce: -0.002,
      pushForce: 0.0001,
      frictionForce: 0,
      maxVelocity: 0.01,
    })
    .display(displayBalls);

  cam.update();

  // describe(`Framerate: ${frameRate().toFixed(2)}FPS`, LABEL);
}

function doubleClicked() {
  fullscreen(!fullscreen());
  cam.setPerspective();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  cam.setPerspective();
}
