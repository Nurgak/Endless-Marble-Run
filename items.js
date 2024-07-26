class Cube extends Shape {
  render() {
    box(1, 1, this.size);
  }
}

class Sphere extends Shape {
  render() {
    specularMaterial(255);
    shininess(127);
    sphere(this.size, 16, 16);
  }
}

class CollisionLine extends CollisionObject {
  constructor(v0, v1) {
    super();
    this.v0 = v0;
    this.v1 = v1;
  }
}

class CollisionPlane extends CollisionObject {
  constructor(v0, v1, v2, v3) {
    super();
    this.v0 = v0;
    this.v1 = v1;
    this.v2 = v2;
    this.v3 = v3;
  }
}

class Ball extends Item {
  static #bounciness = 0.3;
  static #velocityLimit = 0.03;
  static #radius = 0.18;
  #collision = false;

  constructor(position, mass) {
    const pose = new Pose(position);
    super(new Sphere(Ball.#radius), pose, mass);
  }

  roll() {
    // Poor emulation of rolling using Euler angles.
    // The rotation axes must be ordered as Z, Y, X for this to work.
    const angleZ = atan2(this.velocity.y, this.velocity.x);
    const speed =
      createVector(this.velocity.x, this.velocity.y).mag() / this.shape.size;
    this.pose.rotation.y += speed;
    this.pose.rotation.z = angleZ;
    return this;
  }

  update() {
    // Limit speed in x, y directions to avoid falling off.
    const limited = p5.Vector.limit(
      createVector(this.velocity.x, this.velocity.y),
      Ball.#velocityLimit
    );
    this.velocity.x = limited.x;
    this.velocity.y = limited.y;
    return super.update();
  }

  checkCollision(other) {
    let collision = false;
    if (other instanceof Ball) {
      collision = Ball.collisionBall(this, other) || collision;
    } else if (other instanceof Box) {
      const distance = other.pose.position.dist(this.pose.position);
      if (distance <= Math.sqrt(3) + this.shape.size) {
        for (const colObj of other.collisionObjects) {
          if (colObj instanceof CollisionLine) {
            const [v0, v1] = [colObj.v0, colObj.v1].map(Box.place, other);
            collision = Ball.collisionLine(this, v0, v1) || collision;
          } else if (colObj instanceof CollisionPlane) {
            const [v0, v1, v2, v3] = [colObj.v0, colObj.v1, colObj.v2, colObj.v3].map(Box.place, other);
            collision = Ball.collisionPlane(this, v0, v1, v2, v3) || collision;
          }
        }
      }
    }
    this.#collision = this.#collision || collision;
    return collision;
  }

  static collisionPoint(ball, pt) {
    const normal = p5.Vector.sub(ball.pose.position, pt).normalize();
    const dot = ball.velocity.dot(normal);
    const bounceVelocity = p5.Vector.mult(normal, dot);
    ball.velocity.sub(bounceVelocity);
    ball.velocity.sub(bounceVelocity.mult(Ball.#bounciness));

    const projectedDist = ball.pose.position.dist(pt) - ball.shape.size;
    const offsetVector = normal.mult(projectedDist);
    ball.pose.position.sub(offsetVector);
    return true;
  }

  static collisionPlane(ball, v0, v1, v2, v3) {
    let collision = false;
    const [minX, maxX] = [min(v0.x, v1.x, v2.x, v3.x), max(v0.x, v1.x, v2.x, v3.x)];
    const [minY, maxY] = [min(v0.y, v1.y, v2.y, v3.y), max(v0.y, v1.y, v2.y, v3.y)];
    if (
      ball.pose.position.x > minX &&
      ball.pose.position.x < maxX &&
      ball.pose.position.y > minY &&
      ball.pose.position.y < maxY
    ) {
      const projectedPoint = createVector(
        ball.pose.position.x,
        ball.pose.position.y,
        v0.z
      )
      if (ball.pose.position.dist(projectedPoint) < ball.shape.size) {
        collision = Ball.collisionPoint(ball, projectedPoint) || collision;
      }
    }
    return collision;
  }

  static collisionLine(ball, v0, v1) {
    let collision = false;
    const lineDefV0 = p5.Vector.sub(v1, v0).normalize();
    const lineDefV1 = p5.Vector.sub(v0, v1).normalize();
    const pDistance = lineDefV0.dot(p5.Vector.sub(ball.pose.position, v0));
    const projectedPoint = p5.Vector.mult(lineDefV0, pDistance).add(v0);
    if (ball.pose.position.dist(projectedPoint) < ball.shape.size) {
      const distV0 = lineDefV0.dot(p5.Vector.sub(ball.pose.position, v0));
      const distV1 = lineDefV1.dot(p5.Vector.sub(ball.pose.position, v1));
      if (distV0 > 0 && distV1 > 0) {
        collision = Ball.collisionPoint(ball, projectedPoint) || collision;
      } else if (ball.pose.position.dist(v0) < ball.shape.size) {
        collision = Ball.collisionPoint(ball, v0) || collision;
      } else if (ball.pose.position.dist(v1) < ball.shape.size) {
        collision = Ball.collisionPoint(ball, v1) || collision;
      }
    }
    return collision;
  }

  static collisionBall(b0, b1) {
    const distance = b0.pose.position.dist(b1.pose.position);
    const collision = distance < b0.shape.size + b1.shape.size;
    if (collision) {
      const normal = p5.Vector.sub(
        b0.pose.position,
        b1.pose.position
      ).normalize();

      // Transfer kinetic energy.
      const relativeVelocity = p5.Vector.sub(b0.velocity, b1.velocity);
      const dot = relativeVelocity.dot(normal);
      const normalVelocity = p5.Vector.mult(normal, dot);
      normalVelocity.mult(Ball.#bounciness);
      b0.velocity.sub(normalVelocity);
      b1.velocity.add(normalVelocity);

      // Do not let the balls merge.
      const delta = normal.mult((b0.shape.size + b1.shape.size - distance) / 2);
      b0.pose.position.add(delta);
      b1.pose.position.sub(delta);
    }
    return collision;
  }
    
  display() {
    if (this.debug) {
      if (this.#collision) {
        this.color = color(255, 0, 0);
      } else {
        this.color = color(0, 255, 0);
      }
      this.#collision = false;
    }
    super.display();
  }
}

class Box extends Item {
  static grooveRadius = 1 / 5;

  constructor(position, angle) {
    const pose = new Pose(position, createVector(0, 0, angle));
    super(new Cube(1), pose, 0);
    if (this.constructor == Box) {
      throw new Error(`Illegal abstract class ${this.constructor.name} instantiation.`);
    };
    this.color = color(random(255), random(255), random(255));
    this.collisionObjects = [];
    this.anchors = [];
  }

  static grooveStraight(v0, v1, collisionObjects, anchors = null) {
    const l0 = createVector(v0[0], v0[1], v0[2]);
    const l1 = createVector(v1[0], v1[1], v1[2]);
    collisionObjects.push(...Box.#collisionStraight(l0, l1));
    if (anchors) {
      const l2 = createVector(-v0[0], -v0[1], v0[2]);
      const l3 = createVector(-v1[0], -v1[1], v1[2]);
      anchors.push(
        ...[
          { enter: l0, exit: l1 },
          { enter: l2, exit: l3 },
        ]
      );
    }
  }

  static grooveCurve(v0, v1, c0, collisionObjects, anchors) {
    collisionObjects.push(
      ...Box.#collisionCurve(
        createVector(c0[0], c0[1], c0[2]),
        1 / 2 + Box.grooveRadius
      )
    );
    collisionObjects.push(
      ...Box.#collisionCurve(
        createVector(c0[0], c0[1], c0[2]),
        1 / 2 - Box.grooveRadius
      )
    );
    collisionObjects.push(new CollisionPlane(
      createVector(-1/2, -1/2, c0[2] - Box.grooveRadius),
      createVector(-1/2, 1/2, c0[2] - Box.grooveRadius),
      createVector(1/2, 1/2, c0[2] - Box.grooveRadius),
      createVector(1/2, -1/2, c0[2] - Box.grooveRadius),
    ));

    const l0 = createVector(v0[0], v0[1], v0[2]);
    const l1 = createVector(v1[0], v1[1], v1[2]);
    const l2 = createVector(v0[1], v0[0], v0[2]);
    const l3 = createVector(v1[1], v1[0], v1[2]);
    anchors.push(
      ...[
        { enter: l0, exit: l1 },
        { enter: l2, exit: l3 },
      ]
    );
  }

  static #collisionCurve(center, radius, segments = 6) {
    const lines = [];
    const stepAngle = HALF_PI / segments;
    for (let angle = PI; angle < PI + HALF_PI; angle += stepAngle) {
      const angleA = angle;
      const angleB = angle + stepAngle;

      const dXv1 = radius * Math.cos(angleA);
      const dYv1 = radius * Math.sin(angleA);
      const dZv1 = center.z;
      const dXv2 = radius * Math.cos(angleB);
      const dYv2 = radius * Math.sin(angleB);
      const dZv2 = center.z;

      lines.push(new CollisionLine(
        p5.Vector.add(center, [dXv1, dYv1, 0]),
        p5.Vector.add(center, [dXv2, dYv2, 0]),
      ));
    }
    return lines;
  }

  static #collisionStraight(start, end, radius) {
    // Special case for when the hole is vertical.
    let normalVector = createVector(0, 0, 1);
    let normalHorizontal = createVector(1, 0, 0);
    let normalVertical = createVector(0, 1, 0);
    if (start.x != end.x || start.y != end.y) {
      normalVector = p5.Vector.sub(end, start).normalize();
      normalHorizontal = p5.Vector.cross(
        createVector(0, 0, 1),
        normalVector
      ).normalize();
      normalVertical = createVector(0, 0, 1);
    }

    const offsetBottom = p5.Vector.mult(normalVertical, -Box.grooveRadius);
    const offsetLeft = p5.Vector.mult(normalHorizontal, Box.grooveRadius);
    const offsetRight = p5.Vector.mult(normalHorizontal, -Box.grooveRadius);

    return [
      new CollisionLine(
        p5.Vector.add(start, offsetBottom),
        p5.Vector.add(end, offsetBottom),
      ),
      new CollisionLine(
        p5.Vector.add(start, offsetLeft),
        p5.Vector.add(end, offsetLeft),
      ),
      new CollisionLine(
        p5.Vector.add(start, offsetRight),
        p5.Vector.add(end, offsetRight),
      ),
    ];
  }

  static place(vector) {
    return p5.Vector.add(
      this.pose.position,
      p5.Vector.rotateZ(vector, this.pose.rotation.z)
    );
  }

  display() {
    super.display();
    if (this.debug) {
      push();
      strokeWeight(0.05);
      for (const item of this.collisionObjects) {
        if (item instanceof CollisionLine) {
          const [v0, v1] = [item.v0, item.v1].map(Box.place, this);
          stroke(255, 0, 0);
          line(v0.x, v0.y, v0.z, v1.x, v1.y, v1.z);
        } else if (item instanceof CollisionPlane) {
          const [v0, v1, v2, v3] = [item.v0, item.v1, item.v2, item.v3].map(Box.place, this);
          stroke(255, 0, 255);
          translate(createVector((v0.x + v2.x) / 2, (v0.y + v2.y) / 2, v0.z));
          plane(1, 1);
          resetMatrix();
        }
      }

      stroke(255, 255, 0);
      for (const anchorSet of this.anchors) {
        const [v0, v1] = [anchorSet.enter, anchorSet.exit || createVector(0, 0, 0)].map(Box.place, this);
        line(v0.x, v0.y, v0.z, v1.x, v1.y, v1.z);
      }
      pop();
    }
    return this;
  }
}

class Half extends Box {
  constructor(position, angle) {
    super(position, angle);
    if (this.constructor == Half) {
      throw new Error(`Illegal abstract class ${this.constructor.name} instantiation.`);
    };
    this.shape = new Cube(0.5);
  }
}

class Straight extends Box {
  constructor(position, angle) {
    super(position, angle);
    this.model = this.getModel("assets/straight.stl");
    Box.grooveStraight(
      [0, 1 / 2, 0],
      [0, -1 / 2, 0],
      this.collisionObjects,
      this.anchors
    );
    Box.grooveStraight(
      [0, 1 / 2, 1 / 2],
      [0, -1 / 2, 1 / 2],
      this.collisionObjects,
      this.anchors
    );
  }
}

class HalfStraight extends Half {
  constructor(position, angle) {
    super(position, angle);
    this.model = this.getModel("assets/half_straight.stl");
    Box.grooveStraight([0, 1 / 2, 0], [0, -1 / 2, 0], this.collisionObjects, this.anchors);
  }
}

class Turn extends Box {
  constructor(position, angle) {
    super(position, angle);
    Box.grooveCurve(
      [0, 1 / 2, 1 / 2],
      [1 / 2, 0, 1 / 2],
      [1 / 2, 1 / 2, 1 / 2],
      this.collisionObjects,
      this.anchors
    );
  }
}

class HalfTurn extends Half {
  constructor(position, angle) {
    super(position, angle);
    this.model = this.getModel("assets/half_turn.stl");
    Box.grooveCurve(
      [0, 1 / 2, 0],
      [1 / 2, 0, 0],
      [1 / 2, 1 / 2, 0],
      this.collisionObjects,
      this.anchors
    );
  }
}

class TurnStraightA extends Turn {
  constructor(position, angle) {
    super(position, angle);
    this.model = this.getModel("assets/turn_straight_a.stl");
    Box.grooveStraight([0, 1 / 2, 0], [0, -1 / 2, 0], this.collisionObjects, this.anchors);
  }
}

class TurnStraightB extends Turn {
  constructor(position, angle) {
    super(position, angle);
    this.model = this.getModel("assets/turn_straight_b.stl");
    Box.grooveStraight([1 / 2, 0, 0], [-1 / 2, 0, 0], this.collisionObjects, this.anchors);
  }
}

class CrossHole extends Box {
  constructor(position, angle) {
    super(position, angle);
    Box.grooveStraight(
      [Box.grooveRadius, 0, 1 / 2],
      [1 / 2, 0, 1 / 2],
      this.collisionObjects
    );
    Box.grooveStraight(
      [-Box.grooveRadius, 0, 1 / 2],
      [-1 / 2, 0, 1 / 2],
      this.collisionObjects
    );
    Box.grooveStraight(
      [0, Box.grooveRadius, 1 / 2],
      [0, 1 / 2, 1 / 2],
      this.collisionObjects
    );
    Box.grooveStraight(
      [0, -Box.grooveRadius, 1 / 2],
      [0, -1 / 2, 1 / 2],
      this.collisionObjects
    );
  }
}

class CrossStraight extends CrossHole {
  constructor(position, angle) {
    super(position, angle);
    this.model = this.getModel("assets/cross_straight.stl");
    this.anchors.push(
      ...[
        {
          enter: createVector(1 / 2, 0, 1 / 2),
          exit: createVector(-1 / 2, 0, 1 / 2),
        },
        {
          enter: createVector(-1 / 2, 0, 1 / 2),
          exit: createVector(1 / 2, 0, 1 / 2),
        },
        {
          enter: createVector(0, 1 / 2, 1 / 2),
          exit: createVector(0, -1 / 2, 1 / 2),
        },
        {
          enter: createVector(0, -1 / 2, 1 / 2),
          exit: createVector(0, 1 / 2, 1 / 2),
        },
        {
          enter: createVector(1 / 2, 0, 0),
          exit: createVector(-1 / 2, 0, 0),
        },
        {
          enter: createVector(-1 / 2, 0, 0),
          exit: createVector(1 / 2, 0, 0),
        },
      ]
    );

    Box.grooveStraight([1 / 2, 0, 0], [-1 / 2, 0, 0], this.collisionObjects);
    
    this.collisionObjects.push(new CollisionPlane(
      createVector(-1/2, -1/2, 1 / 2 - Box.grooveRadius),
      createVector(-1/2, 1/2, 1 / 2 - Box.grooveRadius),
      createVector(1/2, 1/2, 1 / 2 - Box.grooveRadius),
      createVector(1/2, -1/2, 1 / 2 - Box.grooveRadius),
    ));
  }
}

class RampA {
  static getCollisionObjects() {
    const collisionObjects = [];
    Box.grooveStraight(
      [0, 0, Box.grooveRadius],
      [0, 0, 0],
      collisionObjects
    );
    Box.grooveStraight(
      [0, -Box.grooveRadius, Box.grooveRadius],
      [0, 0, 0],
      collisionObjects
    );
    Box.grooveStraight(
      [0, -Box.grooveRadius, 0],
      [0, 1 / 2, 0],
      collisionObjects
    );
    return collisionObjects;
  }
}

class RampB {
  static getCollisionObjects() {
    const collisionObjects = [];
    Box.grooveStraight(
      [0, 0, Box.grooveRadius],
      [0, 0, -1 / 2 + Box.grooveRadius],
      collisionObjects
    );
    Box.grooveStraight(
      [0, -Box.grooveRadius, -1 / 2 + 2 * Box.grooveRadius],
      [0, 0, -1 / 2 + Box.grooveRadius],
      collisionObjects
    );
    Box.grooveStraight(
      [0, -Box.grooveRadius, -1 / 2 + Box.grooveRadius],
      [0, 1 / 2, -1 / 2 + Box.grooveRadius],
      collisionObjects
    );
    return collisionObjects;
  }
}

class CrossRampA extends CrossHole {
  constructor(position, angle) {
    super(position, angle);
    this.model = this.getModel("assets/cross_ramp_a.stl");
    this.collisionObjects.push(...RampA.getCollisionObjects());

    this.anchors.push(
      ...[
        {
          enter: createVector(1 / 2, 0, 1 / 2),
          exit: createVector(0, 1 / 2, 0),
        },
        {
          enter: createVector(0, -1 / 2, 1 / 2),
          exit: createVector(0, 1 / 2, 0),
        },
        {
          enter: createVector(-1 / 2, 0, 1 / 2),
          exit: createVector(0, 1 / 2, 0),
        },
      ]
    );
  }
}

class CrossRampB extends CrossHole {
  constructor(position, angle) {
    super(position, angle);
    this.model = this.getModel("assets/cross_ramp_b.stl");
    this.collisionObjects.push(...RampB.getCollisionObjects());
    
    this.anchors.push(
      ...[
        {
          enter: createVector(1 / 2, 0, 1 / 2),
          exit: createVector(0, 1 / 2, -1 / 2 + Box.grooveRadius),
        },
        {
          enter: createVector(0, 1 / 2, 1 / 2),
          exit: createVector(0, 1 / 2, -1 / 2 + Box.grooveRadius),
        },
        {
          enter: createVector(-1 / 2, 0, 1 / 2),
          exit: createVector(0, 1 / 2, -1 / 2 + Box.grooveRadius),
        },
        {
          enter: createVector(0, -1 / 2, 1 / 2),
          exit: createVector(0, 1 / 2, -1 / 2 + Box.grooveRadius),
        },
      ]
    );
  }
}

class TurnThreeWay extends Box {
  constructor(position, angle) {
    super(position, angle);
    const step = HALF_PI / 8;
    const radiusInner = 1 / 2 - Box.grooveRadius;
    const radiusBottom = 1 / 2;
    const radiusOuter = 1 / 2 + Box.grooveRadius;
    for (let i = 0; i < HALF_PI; i += step) {
      this.collisionObjects.push(new CollisionLine(
        createVector(-1 / 2 + radiusInner * cos(i), -1 / 2 + radiusInner * sin(i), 1 / 2),
        createVector(-1 / 2 + radiusInner * cos(i + step), -1 / 2 + radiusInner * sin(i + step), 1 / 2),
      ));
      this.collisionObjects.push(new CollisionLine(
        createVector(1 / 2 - radiusInner * cos(i), -1 / 2 + radiusInner * sin(i), 1 / 2),
        createVector(1 / 2 - radiusInner * cos(i + step), -1 / 2 + radiusInner * sin(i + step), 1 / 2),
      ));
      if (radiusBottom * cos(i) < 1 / 2 - Box.grooveRadius) {
        this.collisionObjects.push(new CollisionLine(
          createVector(1 / 2 - radiusBottom * cos(i), -1 / 2 + radiusBottom * sin(i), 1 / 2 - Box.grooveRadius),
          createVector(1 / 2 - radiusBottom * cos(i + step), -1 / 2 + radiusBottom * sin(i + step), 1 / 2 - Box.grooveRadius),
        ));
        this.collisionObjects.push(new CollisionLine(
          createVector(-1 / 2 + radiusBottom * cos(i), -1 / 2 + radiusBottom * sin(i), 1 / 2 - Box.grooveRadius),
          createVector(-1 / 2 + radiusBottom * cos(i + step), -1 / 2 + radiusBottom * sin(i + step), 1 / 2 - Box.grooveRadius),
        ));
      }
      if (radiusOuter * cos(i) < 1 / 2 - Box.grooveRadius) {
        this.collisionObjects.push(new CollisionLine(
          createVector(1 / 2 - radiusOuter * cos(i), -1 / 2 + radiusOuter * sin(i), 1 / 2),
          createVector(1 / 2 - radiusOuter * cos(i + step), -1 / 2 + radiusOuter * sin(i + step), 1 / 2),
        ));
        this.collisionObjects.push(new CollisionLine(
          createVector(-1 / 2 + radiusOuter * cos(i), -1 / 2 + radiusOuter * sin(i), 1 / 2),
          createVector(-1 / 2 + radiusOuter * cos(i + step), -1 / 2 + radiusOuter * sin(i + step), 1 / 2),
        ));
      }
    }
  }
}

class CrossOpenRampA extends TurnThreeWay {
  constructor(position, angle) {
    super(position, angle);
    this.model = this.getModel("assets/cross_openramp_a.stl");
    
    this.anchors.push(
      ...[
        {
          enter: createVector(1 / 2, 0, 1 / 2),
          exit: createVector(0, 1 / 2, 0),
        },
        {
          enter: createVector(-1 / 2, 0, 1 / 2),
          exit: createVector(0, 1 / 2, 0),
        },
        {
          enter: createVector(0, -1 / 2, 1 / 2),
          exit: createVector(0, 1 / 2, 0),
        },
      ]
    );

    Box.grooveStraight(
      [0, -1 / 2 + 1 / 10, 1 / 2],
      [0, -1 / 2, 1 / 2],
      this.collisionObjects
    );
    Box.grooveStraight(
      [0, -1 / 2 + 1 / 10, 1 / 2],
      [0, -1 / 16, 1 / 6],
      this.collisionObjects
    );
    Box.grooveStraight(
      [0, -1 / 16, 1 / 6],
      [0, 1 / 4, 1 / 32],
      this.collisionObjects
    );
    Box.grooveStraight(
      [0, 1 / 4, 1 / 32],
      [0, 1 / 2, 0],
      this.collisionObjects
    );
  }
}

class CrossOpenRampB extends TurnThreeWay {
  constructor(position, angle) {
    super(position, angle);
    this.model = this.getModel("assets/cross_openramp_b.stl");
    
    this.anchors.push(
      ...[
        {
          enter: createVector(1 / 2, 0, 1 / 2),
          exit: createVector(0, 1 / 2, -1 / 2 + Box.grooveRadius),
        },
        {
          enter: createVector(0, 1 / 2, 1 / 2),
          exit: createVector(0, 1 / 2, -1 / 2 + Box.grooveRadius),
        },
        {
          enter: createVector(-1 / 2, 0, 1 / 2),
          exit: createVector(0, 1 / 2, -1 / 2 + Box.grooveRadius),
        },
        {
          enter: createVector(0, -1 / 2, 1 / 2),
          exit: createVector(0, 1 / 2, -1 / 2 + Box.grooveRadius),
        },
      ]
    );

    Box.grooveStraight(
      [0, -1 / 2 + 1 / 10, 1 / 2],
      [0, -1 / 2, 1 / 2],
      this.collisionObjects
    );
    Box.grooveStraight(
      [0, -1 / 2 + 1 / 10, 1 / 2],
      [0, - 1 / 4, 1 / 8],
      this.collisionObjects
    );
    Box.grooveStraight(
      [0, - 1 / 4, 1 / 8],
      [0, 0, - 1 / 8],
      this.collisionObjects
    );
    Box.grooveStraight(
      [0, 0, - 1 / 8],
      [0, 1 / 2, -1 / 2 + Box.grooveRadius + 1 / 10],
      this.collisionObjects
    );
  }
}

class End extends Box {
  constructor(position, angle) {
    super(position, angle);
    this.model = this.getModel("assets/end.stl");
    this.anchors.push(
      ...[
        {
          enter: createVector(1 / 2, 0, 1 / 2),
          exit: null,
        },
        {
          enter: createVector(-1 / 2, 0, 1 / 2),
          exit: null,
        },
        {
          enter: createVector(0, 1 / 2, 1 / 2),
          exit: null,
        },
        {
          enter: createVector(0, -1 / 2, 1 / 2),
          exit: null,
        },
      ]
    );

    const holeRadius = 3.7 / 5 / 2;
    const holeDepth = -1 / 2 + 1 / 5;

    Box.grooveStraight([1 / 2, 0, 1 / 2], [holeRadius, 0, 1 / 2], this.collisionObjects);
    Box.grooveStraight([-1 / 2, 0, 1 / 2], [-holeRadius, 0, 1 / 2], this.collisionObjects);
    Box.grooveStraight([0, holeRadius, 1 / 2], [0, 1 / 2, 1 / 2], this.collisionObjects);
    Box.grooveStraight([0, -holeRadius, 1 / 2], [0, -1 / 2, 1 / 2], this.collisionObjects);

    for (let angle = 0; angle < TWO_PI; angle += TWO_PI / 16) {
      this.collisionObjects.push(new CollisionLine(
        createVector(
          holeRadius * Math.cos(angle),
          holeRadius * Math.sin(angle),
          1 / 2 - Box.grooveRadius
        ),
        createVector(
          holeRadius * Math.cos(angle),
          holeRadius * Math.sin(angle),
          holeDepth
        ),
      ));
    }
    this.collisionObjects.push(new CollisionPlane(
      createVector(-1/2, -1/2, holeDepth),
      createVector(-1/2, 1/2, holeDepth),
      createVector(1/2, 1/2, holeDepth),
      createVector(1/2, -1/2, holeDepth),
    ));
  }
}

class HalfEnd extends Half {
  constructor(position, angle) {
    super(position, angle);
    this.model = this.getModel("assets/half_end.stl");
    this.anchors.push(
      ...[
        {
          enter: createVector(1 / 2, 0, 0),
          exit: null,
        },
        {
          enter: createVector(-1 / 2, 0, 0),
          exit: null,
        },
        {
          enter: createVector(0, 1 / 2, 0),
          exit: null,
        },
        {
          enter: createVector(0, -1 / 2, 0),
          exit: null,
        },
      ]
    );

    const holeRadius = 3.7 / 5 / 2;
    const holeDepth = -1 / 2 + 1 / 7;

    Box.grooveStraight([1 / 2, 0, 0], [holeRadius, 0, 0], this.collisionObjects);
    Box.grooveStraight([-1 / 2, 0, 0], [-holeRadius, 0, 0], this.collisionObjects);
    Box.grooveStraight([0, holeRadius, 0], [0, 1 / 2, 0], this.collisionObjects);
    Box.grooveStraight([0, -holeRadius, 0], [0, -1 / 2, 0], this.collisionObjects);

    for (let angle = 0; angle < TWO_PI; angle += TWO_PI / 16) {
      this.collisionObjects.push(new CollisionLine(
        createVector(
          holeRadius * Math.cos(angle),
          holeRadius * Math.sin(angle),
          -Box.grooveRadius
        ),
        createVector(
          holeRadius * Math.cos(angle),
          holeRadius * Math.sin(angle),
          holeDepth
        ),
      ));
    }
    this.collisionObjects.push(new CollisionPlane(
      createVector(-1/2, -1/2, holeDepth),
      createVector(-1/2, 1/2, holeDepth),
      createVector(1/2, 1/2, holeDepth),
      createVector(1/2, -1/2, holeDepth),
    ));
  }
}

class Funnel extends Box {
  constructor(position, angle) {
    super(position, angle);
    for (let alpha = 0; alpha < TWO_PI; alpha += TWO_PI / 16) {
      this.collisionObjects.push(new CollisionLine(
        createVector(Math.cos(alpha) / 2, Math.sin(alpha) / 2, 1 / 2),
        createVector(
          Box.grooveRadius * Math.cos(alpha),
          Box.grooveRadius * Math.sin(alpha),
          Box.grooveRadius
        ),
      ));
      this.collisionObjects.push(new CollisionLine(
        createVector(
          Math.cos(alpha) / 2,
          Math.sin(alpha) / 2,
          1 - Box.grooveRadius
        ),
        createVector(Math.cos(alpha) / 2, Math.sin(alpha) / 2, 1 / 2),
      ));
    }
  }
}

class FunnelRampA extends Funnel {
  constructor(position, angle) {
    super(position, angle);
    this.model = this.getModel("assets/funnel_ramp_a.stl");
    this.collisionObjects.push(...RampA.getCollisionObjects());
    this.anchors.push(
      ...[
        {
          enter: createVector(1 / 2, 0, 1),
          exit: createVector(0, 1 / 2, 0),
        },
        {
          enter: createVector(0, 1 / 2, 1),
          exit: createVector(0, 1 / 2, 0),
        },
        {
          enter: createVector(-1 / 2, 0, 1),
          exit: createVector(0, 1 / 2, 0),
        },
        {
          enter: createVector(0, -1 / 2, 1),
          exit: createVector(0, 1 / 2, 0),
        },
      ]
    );
  }
}

class FunnelRampB extends Funnel {
  constructor(position, angle) {
    super(position, angle);
    this.model = this.getModel("assets/funnel_ramp_b.stl");
    this.collisionObjects.push(...RampB.getCollisionObjects());
    this.anchors.push(
      ...[
        {
          enter: createVector(1 / 2, 0, 1),
          exit: createVector(0, 1 / 2, -1 / 2 + Box.grooveRadius),
        },
        {
          enter: createVector(0, 1 / 2, 1),
          exit: createVector(0, 1 / 2, -1 / 2 + Box.grooveRadius),
        },
        {
          enter: createVector(-1 / 2, 0, 1),
          exit: createVector(0, 1 / 2, -1 / 2 + Box.grooveRadius),
        },
        {
          enter: createVector(0, -1 / 2, 1),
          exit: createVector(0, 1 / 2, -1 / 2 + Box.grooveRadius),
        },
      ]
    );
  }
}

class Diagonal extends Box {
  constructor(position, angle) {
    super(position, angle);
    this.model = this.getModel("assets/diagonal.stl");
    Box.grooveStraight([0, 1 / 2, 0], [0, -1 / 2, 0], this.collisionObjects, this.anchors);
  }
}

class CrossCrossRamp extends CrossHole {
  constructor(position, angle) {
    super(position, angle);
    this.model = this.getModel("assets/cross_cross_ramp.stl");
    this.anchors.push(
      ...[
        {
          enter: createVector(1 / 2, 0, 1 / 2),
          exit: createVector(0, 1 / 2, -1 / 2 + Box.grooveRadius),
        },
        {
          enter: createVector(-1 / 2, 0, 1 / 2),
          exit: createVector(0, 1 / 2, -1 / 2 + Box.grooveRadius),
        },
        {
          enter: createVector(0, 1 / 2, 1 / 2),
          exit: createVector(0, 1 / 2, -1 / 2 + Box.grooveRadius),
        },
        {
          enter: createVector(0, -1 / 2, 1 / 2),
          exit: createVector(0, 1 / 2, -1 / 2 + Box.grooveRadius),
        },
        {
          enter: createVector(1 / 2, 0, 0),
          exit: createVector(0, 1 / 2, -1 / 2 + Box.grooveRadius),
        },
        {
          enter: createVector(-1 / 2, 0, 0),
          exit: createVector(0, 1 / 2, -1 / 2 + Box.grooveRadius),
        },
        {
          enter: createVector(0, -1 / 2, 0),
          exit: createVector(0, 1 / 2, -1 / 2 + Box.grooveRadius),
        },
      ]
    );

    Box.grooveStraight(
      [0, -1 / 2, 0],
      [0, -Box.grooveRadius, -Box.grooveRadius],
      this.collisionObjects
    );
    Box.grooveStraight(
      [0, -Box.grooveRadius, -Box.grooveRadius],
      [0, 1 / 2, -1 / 2 + Box.grooveRadius],
      this.collisionObjects
    );
    Box.grooveStraight(
      [1 / 2, 0, 0],
      [Box.grooveRadius, 0, 0],
      this.collisionObjects
    );
    Box.grooveStraight(
      [-1 / 2, 0, 0],
      [-Box.grooveRadius, 0, 0],
      this.collisionObjects
    );
  }
}

class HalfCross extends Half {
  constructor(position, angle) {
    super(position, angle);

    this.model = this.getModel("assets/half_cross.stl");
    this.anchors.push(
      ...[
        {
          enter: createVector(1 / 2, 0, 0),
          exit: createVector(-1 / 2, 0, 0),
        },
        {
          enter: createVector(-1 / 2, 0, 0),
          exit: createVector(1 / 2, 0, 0),
        },
        {
          enter: createVector(0, 1 / 2, 0),
          exit: createVector(0, -1 / 2, 0),
        },
        {
          enter: createVector(0, -1 / 2, 0),
          exit: createVector(0, 1 / 2, 0),
        },
      ]
    );

    Box.grooveStraight(
      [Box.grooveRadius, 0, 0],
      [1 / 2, 0, 0],
      this.collisionObjects
    );
    Box.grooveStraight(
      [-Box.grooveRadius, 0, 0],
      [-1 / 2, 0, 0],
      this.collisionObjects
    );
    Box.grooveStraight(
      [0, Box.grooveRadius, 0],
      [0, 1 / 2, 0],
      this.collisionObjects
    );
    Box.grooveStraight(
      [0, -Box.grooveRadius, 0],
      [0, -1 / 2, 0],
      this.collisionObjects
    );

    this.collisionObjects.push(new CollisionPlane(
      createVector(-1/2, -1/2, -Box.grooveRadius),
      createVector(-1/2, 1/2, -Box.grooveRadius),
      createVector(1/2, 1/2, -Box.grooveRadius),
      createVector(1/2, -1/2, -Box.grooveRadius),
    ));
  }
}

class StraightRamp extends Box {
  constructor(position, angle) {
    super(position, angle);
    this.model = this.getModel("assets/straight_ramp.stl");
    this.anchors.push(
      ...[
        {
          enter: createVector(0, 1 / 2, 1 / 2),
          exit: createVector(0, 1 / 2, - 1 / 2 + Box.grooveRadius),
        },
        {
          enter: createVector(0, -1 / 2, 1 / 2),
          exit: createVector(0, 1 / 2, - 1 / 2 + Box.grooveRadius),
        },
      ]
    );

    Box.grooveStraight(
      [0, 1 / 2 - 1 / 5, 1 / 2],
      [0, 1 / 2, 1 / 2],
      this.collisionObjects
    );
    Box.grooveStraight(
      [0, -1 / 2 + 1 / 5, 1 / 2],
      [0, -1 / 2, 1 / 2],
      this.collisionObjects
    );
    Box.grooveStraight(
      [0, -1 / 2 + 1 / 5, 1 / 2],
      [0, 1 / 2, -1 / 2 + Box.grooveRadius],
      this.collisionObjects
    );
  }
}
