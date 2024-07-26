p5.Vector.prototype.rotateZ = function (angle) {
  const x = this.x * Math.cos(angle) - this.y * Math.sin(angle);
  const y = this.x * Math.sin(angle) + this.y * Math.cos(angle);
  this.x = x;
  this.y = y;
  return this;
};

p5.Vector.rotateZ = function (vector, angle) {
  return vector.copy().rotateZ(angle);
};

p5.Vector.prototype.distXY = function (other) {
  const a = createVector(this.x, this.y);
  const b = createVector(other.x, other.y);
  return a.dist(b);
};

class Pose {
  constructor(pos = null, rot = null) {
    this.position = pos || createVector(0, 0, 0);
    this.rotation = rot || createVector(0, 0, 0);
  }
}

class Shape {
  constructor(size) {
    this.size = size;
  }
}

class CollisionObject {}

class Item {
  static #models = {};
  #acceleration;
  #dynamic;

  constructor(shape, pose, dynamic = false) {
    this.shape = shape;
    this.pose = pose;
    this.velocity = createVector(0, 0, 0);
    this.#acceleration = createVector(0, 0, 0);
    this.#dynamic = dynamic;
    this.setDebug(false);
  }

  getModel(path) {
    if (!(path in Item.#models)) {
      Item.#models[path] = loadModel(path, {fileType: ".stl",});
    }
    return Item.#models[path];
  }

  setDebug(state) {
    this.debug = state;
    return this;
  }

  applyForce(force) {
    if (!this.#dynamic) {
      console.warn("Item is static, applying a force does not have an effect.");
    }
    this.#acceleration.add(force);
    return this;
  }

  update() {
    this.velocity.add(this.#acceleration);
    this.pose.position.add(this.velocity);
    this.#acceleration.mult(0);
    return this;
  }

  display() {
    push();
    translate(this.pose.position);
    rotateZ(this.pose.rotation.z);
    rotateY(this.pose.rotation.y);
    rotateX(this.pose.rotation.x);
    normalMaterial();
    ambientMaterial(this.color || color(255, 255, 255));
    if (this.debug) {
      stroke(32);
      strokeWeight(0.01);
    }
    if (this.model) {
      model(this.model);
    } else {
      this.shape.render();
    }
    pop();
    return this;
  }
}
