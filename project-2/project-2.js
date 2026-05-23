import p5 from "https://cdn.jsdelivr.net/npm/p5@2.2.3/+esm";
import Matter from "https://cdn.jsdelivr.net/npm/matter-js@0.20.0/+esm";

const { Engine, Bodies, Body, Composite, Events, World } = Matter;

const COLLISION = {
  ROCK: 0x0001,
  BOUNDS: 0x0002,
  CURSOR: 0x0004,
};

const PLAY_BOUNDS_OUTSET = 111;
const WALL_THICKNESS = 100;
const WALL_SURFACE_FRICTION = 0.1;
const WALL_FRICTION_STATIC = 0.5;
const FLOOR_SURFACE_FRICTION = 0.55;
const FLOOR_FRICTION_STATIC = 0.65;
const WALL_RESTITUTION = 0;

const ROCK_IMAGE_PATH = "./Img/grey-boulder-rock-isolated-transparent-background.png";
const BOX_IMAGE_PATH = "./Img/boxbg.png";
const BOX_INSET_LEFT = 0.19;
const BOX_INSET_TOP = 0.19;
const BOX_INSET_WIDTH = 0.62;
const BOX_INSET_HEIGHT = 0.62;
const PAGE_BACKGROUND_COLOR = [216, 208, 196];
const COLLISION_SOUND_PATH = "./sound/lego-sound.mp3";
const COLLISION_SOUND_COOLDOWN_MS = 90;
const COLLISION_SOUND_PITCH_MIN = 0.85;
const COLLISION_SOUND_PITCH_MAX = 1.15;
const ROCK_CONTACT_LABELS = new Set(["cursor", "bound", "bound-floor"]);
const ROCK_DISPLAY_WIDTH = 118;
const ROCK_FALLBACK_ASPECT = 0.84;
const ROCK_COLLISION_INSET = 0.985;
const ROCK_OUTLINE_NORMALIZED = [
  { x: 0.08, y: 0.514 },
  { x: 0.194, y: 0.342 },
  { x: 0.36, y: 0.224 },
  { x: 0.522, y: 0.146 },
  { x: 0.61, y: 0.164 },
  { x: 0.694, y: 0.256 },
  { x: 0.884, y: 0.544 },
  { x: 0.892, y: 0.72 },
  { x: 0.682, y: 0.834 },
  { x: 0.366, y: 0.802 },
  { x: 0.138, y: 0.672 },
  { x: 0.084, y: 0.554 },
];
const ROCK_DENSITY = 0.14;
const ROCK_RESTITUTION = 0.35;
const ROCK_SURFACE_FRICTION = 0.55;
const ROCK_FRICTION_STATIC = 0.5;
const ROCK_FRICTION_AIR = 0.01;

const CURSOR_RADIUS = 22;
const CURSOR_DENSITY = 0.2;
const CURSOR_SURFACE_FRICTION = 0.1;
const CURSOR_FRICTION_STATIC = 0.5;
const CURSOR_RESTITUTION = 0.08;

const GRAVITY_Y = 0.9;
const ENGINE_TIMESTEP_MS = 1000 / 60;
const ENGINE_POSITION_ITERATIONS = 8;
const ENGINE_VELOCITY_ITERATIONS = 6;
const MAX_PIXEL_DENSITY = 2;

const CURSOR_MAX_STEP = 10;
const CURSOR_MAX_SUBSTEPS = 32;
const CURSOR_SWEEP_SAMPLE_SPACING = 8;
const CURSOR_VELOCITY_SCALE = 2.6;
const CURSOR_PUSH_FORCE = 0.0022;
const CURSOR_PUSH_MIN_MOTION = 0.05;
const CURSOR_PUSH_MOTION_BASE = 0.45;
const CURSOR_PUSH_MOTION_GAIN = 1.45;
const CURSOR_PUSH_NORMAL_BLEND = 0.3;
const CURSOR_PUSH_MOTION_BLEND = 0.7;
const CURSOR_VELOCITY_FORCE_SCALE = 0.0018;

const POKE_DURATION_MS = 220;
const POKE_FORWARD_DISTANCE = 34;
const POKE_IMPULSE = 0.98;
const POKE_IMPULSE_EXTENSION_THRESHOLD = 0.92;
const POKE_TETHER_MIN_OFFSET = 0.75;
const CURSOR_FOLLOW_LERP = 0.51;

const ROCK_START_X_RATIO = 0.5;
const ROCK_START_Y_RATIO = 0.55;
const CURSOR_START_X_RATIO = 0.5;
const CURSOR_START_Y_RATIO = 0.5;

function isRockContact(bodyA, bodyB) {
  if (bodyA.label === "rock" && ROCK_CONTACT_LABELS.has(bodyB.label)) {
    return true;
  }

  return bodyB.label === "rock" && ROCK_CONTACT_LABELS.has(bodyA.label);
}

function createCollisionSound(path) {
  const sound = new Audio(path);
  sound.preload = "auto";
  return sound;
}

function randomCollisionPitch() {
  return (
    COLLISION_SOUND_PITCH_MIN
    + Math.random() * (COLLISION_SOUND_PITCH_MAX - COLLISION_SOUND_PITCH_MIN)
  );
}

function playCollisionSound(sound, lastPlayedAt) {
  const now = performance.now();

  if (now - lastPlayedAt < COLLISION_SOUND_COOLDOWN_MS) {
    return lastPlayedAt;
  }

  const clip = sound.cloneNode();
  clip.preservesPitch = false;
  clip.playbackRate = randomCollisionPitch();
  clip.volume = 1;
  clip.play().catch(() => {});

  return now;
}

function unlockCollisionSound(sound) {
  if (!sound || sound.dataset.unlocked === "true") {
    return;
  }

  const clip = sound.cloneNode();
  clip.volume = 0;
  clip.play()
    .then(() => {
      clip.pause();
      sound.dataset.unlocked = "true";
    })
    .catch(() => {});
}

function getRockDisplaySize(rockSprite) {
  if (rockSprite && rockSprite.width > 0) {
    const height = rockSprite.height * (ROCK_DISPLAY_WIDTH / rockSprite.width);

    return {
      width: ROCK_DISPLAY_WIDTH,
      height,
    };
  }

  return {
    width: ROCK_DISPLAY_WIDTH,
    height: ROCK_DISPLAY_WIDTH * ROCK_FALLBACK_ASPECT,
  };
}

function createRockOutlineVertices(displayWidth, displayHeight) {
  return ROCK_OUTLINE_NORMALIZED.map(({ x, y }) => ({
    x: (x - 0.5) * displayWidth * ROCK_COLLISION_INSET,
    y: (y - 0.5) * displayHeight * ROCK_COLLISION_INSET,
  }));
}

function getRockReachFromCenter(rock) {
  let reach = 0;

  for (const vertex of rock.vertices) {
    const distance = Math.hypot(vertex.x - rock.position.x, vertex.y - rock.position.y);

    if (distance > reach) {
      reach = distance;
    }
  }

  return reach;
}

function createRockBody(x, y, displayWidth, displayHeight) {
  const vertices = createRockOutlineVertices(displayWidth, displayHeight);

  return Bodies.fromVertices(
    x,
    y,
    [vertices],
    {
      label: "rock",
      restitution: ROCK_RESTITUTION,
      friction: ROCK_SURFACE_FRICTION,
      frictionStatic: ROCK_FRICTION_STATIC,
      frictionAir: ROCK_FRICTION_AIR,
      density: ROCK_DENSITY,
      collisionFilter: {
        category: COLLISION.ROCK,
        mask: COLLISION.BOUNDS | COLLISION.CURSOR,
      },
    },
    true
  );
}

function createCursorBody(x, y) {
  return Bodies.circle(x, y, CURSOR_RADIUS, {
    label: "cursor",
    friction: CURSOR_SURFACE_FRICTION,
    frictionStatic: CURSOR_FRICTION_STATIC,
    frictionAir: 0,
    restitution: CURSOR_RESTITUTION,
    density: CURSOR_DENSITY,
    collisionFilter: {
      category: COLLISION.CURSOR,
      mask: COLLISION.ROCK,
    },
  });
}

function getLayoutBounds(container) {
  const rect = container.getBoundingClientRect();

  return {
    x: rect.left,
    y: rect.top,
    width: rect.width,
    height: rect.height,
  };
}

function expandBounds(bounds, outset) {
  return {
    x: bounds.x - outset,
    y: bounds.y - outset,
    width: bounds.width + outset * 2,
    height: bounds.height + outset * 2,
  };
}

function createBoundBodies(playBounds) {
  const half = WALL_THICKNESS / 2;
  const centerX = playBounds.x + playBounds.width / 2;
  const centerY = playBounds.y + playBounds.height / 2;
  const sideWallOptions = {
    isStatic: true,
    label: "bound",
    friction: WALL_SURFACE_FRICTION,
    frictionStatic: WALL_FRICTION_STATIC,
    frictionAir: 0,
    restitution: WALL_RESTITUTION,
    collisionFilter: {
      category: COLLISION.BOUNDS,
      mask: COLLISION.ROCK,
    },
  };
  const floorWallOptions = {
    ...sideWallOptions,
    label: "bound-floor",
    friction: FLOOR_SURFACE_FRICTION,
    frictionStatic: FLOOR_FRICTION_STATIC,
  };

  return [
    Bodies.rectangle(
      centerX,
      playBounds.y - half,
      playBounds.width + WALL_THICKNESS * 2,
      WALL_THICKNESS,
      sideWallOptions
    ),
    Bodies.rectangle(
      centerX,
      playBounds.y + playBounds.height + half,
      playBounds.width + WALL_THICKNESS * 2,
      WALL_THICKNESS,
      floorWallOptions
    ),
    Bodies.rectangle(
      playBounds.x - half,
      centerY,
      WALL_THICKNESS,
      playBounds.height + WALL_THICKNESS * 2,
      sideWallOptions
    ),
    Bodies.rectangle(
      playBounds.x + playBounds.width + half,
      centerY,
      WALL_THICKNESS,
      playBounds.height + WALL_THICKNESS * 2,
      sideWallOptions
    ),
  ];
}

function getBoxBackgroundRect(layoutBounds) {
  const width = layoutBounds.width / BOX_INSET_WIDTH;
  const height = layoutBounds.height / BOX_INSET_HEIGHT;

  return {
    x: layoutBounds.x - BOX_INSET_LEFT * width,
    y: layoutBounds.y - BOX_INSET_TOP * height,
    width,
    height,
  };
}

function drawPageBackground(p, layoutBounds, boxSprite) {
  p.background(PAGE_BACKGROUND_COLOR);

  if (!boxSprite || boxSprite.width <= 0) {
    return;
  }

  const { x, y, width, height } = getBoxBackgroundRect(layoutBounds);
  p.image(boxSprite, x, y, width, height);
}

function syncCursorBody(cursorBody, x, y, deltaX, deltaY) {
  Body.setPosition(cursorBody, { x, y });
  Body.setVelocity(cursorBody, {
    x: deltaX * CURSOR_VELOCITY_SCALE,
    y: deltaY * CURSOR_VELOCITY_SCALE,
  });
  Body.setAngularVelocity(cursorBody, 0);
}

function pokeTargetPoint(pointerX, pointerY, rock) {
  const dx = rock.position.x - pointerX;
  const dy = rock.position.y - pointerY;
  const distance = Math.hypot(dx, dy);

  if (distance === 0) {
    return { x: pointerX, y: pointerY };
  }

  const reach = Math.min(POKE_FORWARD_DISTANCE, distance);

  return {
    x: pointerX + (dx / distance) * reach,
    y: pointerY + (dy / distance) * reach,
  };
}

function pokeAmount(elapsedMs) {
  const phase = Math.min(elapsedMs / POKE_DURATION_MS, 1);
  return Math.sin(phase * Math.PI);
}

function applyPokeImpulse(rock, pointerX, pointerY) {
  const dx = rock.position.x - pointerX;
  const dy = rock.position.y - pointerY;
  const distance = Math.hypot(dx, dy);

  if (distance === 0) {
    return;
  }

  Body.applyForce(rock, rock.position, {
    x: (dx / distance) * POKE_IMPULSE,
    y: (dy / distance) * POKE_IMPULSE,
  });
}

function getCursorSubsteps(deltaX, deltaY) {
  const motion = Math.hypot(deltaX, deltaY);

  return Math.min(
    CURSOR_MAX_SUBSTEPS,
    Math.max(1, Math.ceil(motion / CURSOR_MAX_STEP))
  );
}

function applyCursorPush(rock, cursorX, cursorY, deltaX, deltaY) {
  const dx = rock.position.x - cursorX;
  const dy = rock.position.y - cursorY;
  const distance = Math.hypot(dx, dy);
  const touchDistance = getRockReachFromCenter(rock) + CURSOR_RADIUS;

  if (distance >= touchDistance || distance === 0) {
    return;
  }

  const motion = Math.hypot(deltaX, deltaY);
  if (motion < CURSOR_PUSH_MIN_MOTION) {
    return;
  }

  const overlap = touchDistance - distance;
  const normalX = dx / distance;
  const normalY = dy / distance;
  const motionX = deltaX / motion;
  const motionY = deltaY / motion;
  const motionStrength = CURSOR_PUSH_MOTION_BASE + motion * CURSOR_PUSH_MOTION_GAIN;
  const forceScale = CURSOR_PUSH_FORCE * overlap * motionStrength;

  Body.applyForce(rock, rock.position, {
    x: (normalX * CURSOR_PUSH_NORMAL_BLEND + motionX * CURSOR_PUSH_MOTION_BLEND) * forceScale,
    y: (normalY * CURSOR_PUSH_NORMAL_BLEND + motionY * CURSOR_PUSH_MOTION_BLEND) * forceScale,
  });

  Body.applyForce(rock, rock.position, {
    x: deltaX * CURSOR_VELOCITY_FORCE_SCALE * overlap,
    y: deltaY * CURSOR_VELOCITY_FORCE_SCALE * overlap,
  });
}

function applyCursorSweepPush(rock, startX, startY, endX, endY) {
  const travelX = endX - startX;
  const travelY = endY - startY;
  const travel = Math.hypot(travelX, travelY);

  if (travel < CURSOR_PUSH_MIN_MOTION) {
    return;
  }

  const sampleCount = Math.max(1, Math.ceil(travel / CURSOR_SWEEP_SAMPLE_SPACING));
  const sampleDeltaX = travelX / sampleCount;
  const sampleDeltaY = travelY / sampleCount;

  for (let sampleIndex = 0; sampleIndex <= sampleCount; sampleIndex += 1) {
    const t = sampleIndex / sampleCount;
    const sampleX = startX + travelX * t;
    const sampleY = startY + travelY * t;

    applyCursorPush(rock, sampleX, sampleY, sampleDeltaX, sampleDeltaY);
  }
}

function advanceCursorContact(engine, rock, cursorBody, startX, startY, endX, endY, deltaMs) {
  const deltaX = endX - startX;
  const deltaY = endY - startY;
  const substeps = getCursorSubsteps(deltaX, deltaY);
  const stepX = deltaX / substeps;
  const stepY = deltaY / substeps;
  const stepMs = deltaMs / substeps;

  let cursorX = startX;
  let cursorY = startY;

  for (let stepIndex = 0; stepIndex < substeps; stepIndex += 1) {
    const previousX = cursorX;
    const previousY = cursorY;
    cursorX += stepX;
    cursorY += stepY;

    syncCursorBody(cursorBody, cursorX, cursorY, stepX, stepY);
    applyCursorSweepPush(rock, previousX, previousY, cursorX, cursorY);
    applyCursorPush(rock, cursorX, cursorY, stepX, stepY);
    Engine.update(engine, stepMs);
    syncCursorBody(cursorBody, cursorX, cursorY, stepX, stepY);
  }
}

function drawRock(p, rock, rockSprite) {
  const { x, y } = rock.position;
  const angle = rock.angle;
  const { width: displayWidth, height: displayHeight } = getRockDisplaySize(rockSprite);

  p.push();
  p.translate(x, y);
  p.rotate(angle);

  if (rockSprite && rockSprite.width > 0) {
    p.imageMode(p.CENTER);
    p.image(rockSprite, 0, 0, displayWidth, displayHeight);
  } else {
    const outlineVertices = createRockOutlineVertices(displayWidth, displayHeight);

    p.noStroke();
    p.fill(92, 86, 78);
    p.beginShape();
    for (const vertex of outlineVertices) {
      p.vertex(vertex.x, vertex.y);
    }
    p.endShape(p.CLOSE);
  }

  p.pop();
}

function drawCursorCollider(p, cursorBody) {
  const { x, y } = cursorBody.position;

  p.noFill();
  p.stroke(47, 42, 36, 120);
  p.strokeWeight(2);
  p.circle(x, y, CURSOR_RADIUS * 2);
}

function drawCustomCursor(p, rock, cursorX, cursorY, anchorX, anchorY) {
  const rockX = rock.position.x;
  const rockY = rock.position.y;
  const aimAngle = Math.atan2(rockY - cursorY, rockX - cursorX);
  const distance = Math.hypot(rockX - cursorX, rockY - cursorY);
  const reach = p.constrain(distance / 220, 0.35, 1);

  p.push();
  p.translate(cursorX, cursorY);
  p.rotate(aimAngle);

  p.noFill();
  p.stroke(47, 42, 36, 150);
  p.strokeWeight(1.5);
  p.circle(0, 0, CURSOR_RADIUS * 2.15);

  p.stroke(47, 42, 36, 210);
  p.strokeWeight(2);
  p.line(-CURSOR_RADIUS * 0.55, 0, CURSOR_RADIUS * 0.55, 0);
  p.line(0, -CURSOR_RADIUS * 0.55, 0, CURSOR_RADIUS * 0.55);

  p.noStroke();
  p.fill(47, 42, 36, 90);
  p.triangle(
    CURSOR_RADIUS * (0.35 + reach * 0.45),
    0,
    -CURSOR_RADIUS * 0.45,
    -CURSOR_RADIUS * 0.34,
    -CURSOR_RADIUS * 0.45,
    CURSOR_RADIUS * 0.34
  );

  p.fill(239, 232, 220);
  p.stroke(47, 42, 36);
  p.strokeWeight(1.5);
  p.circle(-CURSOR_RADIUS * 0.62, 0, CURSOR_RADIUS * 0.28);

  p.push();
  p.rotate(-aimAngle);
  p.noFill();
  p.stroke(47, 42, 36, 120);
  p.strokeWeight(1.25);
  p.line(0, 0, rockX - cursorX, rockY - cursorY);
  p.pop();

  if (Math.hypot(cursorX - anchorX, cursorY - anchorY) > POKE_TETHER_MIN_OFFSET) {
    p.push();
    p.rotate(-aimAngle);
    p.noFill();
    p.stroke(47, 42, 36, 90);
    p.strokeWeight(1.25);
    p.line(anchorX - cursorX, anchorY - cursorY, 0, 0);
    p.pop();
  }

  p.pop();
}

const sketch = (p) => {
  let container;
  let engine;
  let rock;
  let cursorBody;
  let boundBodies = [];
  let layoutBounds = { x: 0, y: 0, width: 0, height: 0 };
  let playBounds = { x: 0, y: 0, width: 0, height: 0 };
  let previousPointerX = 0;
  let previousPointerY = 0;
  let pointerFollowX = 0;
  let pointerFollowY = 0;
  let pokeElapsedMs = POKE_DURATION_MS;
  let pokeImpulseApplied = false;
  let boundsObserver;
  let rockSprite;
  let boxSprite;
  let collisionSound;
  let lastCollisionSoundAt = 0;
  let sceneReady = false;

  function refreshPlayBounds() {
    layoutBounds = getLayoutBounds(container);
    playBounds = expandBounds(layoutBounds, PLAY_BOUNDS_OUTSET);
  }

  function rebuildBounds() {
    if (boundBodies.length) {
      Composite.remove(engine.world, boundBodies);
    }

    refreshPlayBounds();
    boundBodies = createBoundBodies(playBounds);
    Composite.add(engine.world, boundBodies);
  }

  function resizeScene() {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
    rebuildBounds();
  }

  p.setup = async () => {
    container = document.querySelector(".container");
    const canvas = p.createCanvas(p.windowWidth, p.windowHeight);
    canvas.class("page-canvas");
    p.pixelDensity(Math.min(MAX_PIXEL_DENSITY, window.devicePixelRatio || 1));
    p.noCursor();

    try {
      [rockSprite, boxSprite] = await Promise.all([
        p.loadImage(ROCK_IMAGE_PATH),
        p.loadImage(BOX_IMAGE_PATH),
      ]);
    } catch (error) {
      rockSprite = null;
      boxSprite = null;
      console.error("Failed to load project images", error);
    }

    engine = Engine.create();
    engine.gravity.y = GRAVITY_Y;
    engine.positionIterations = ENGINE_POSITION_ITERATIONS;
    engine.velocityIterations = ENGINE_VELOCITY_ITERATIONS;

    refreshPlayBounds();
    const rockDisplay = getRockDisplaySize(rockSprite);
    rock = createRockBody(
      playBounds.x + playBounds.width * ROCK_START_X_RATIO,
      playBounds.y + playBounds.height * ROCK_START_Y_RATIO,
      rockDisplay.width,
      rockDisplay.height
    );
    cursorBody = createCursorBody(
      playBounds.x + playBounds.width * CURSOR_START_X_RATIO,
      playBounds.y + playBounds.height * CURSOR_START_Y_RATIO
    );
    previousPointerX = cursorBody.position.x;
    previousPointerY = cursorBody.position.y;
    pointerFollowX = cursorBody.position.x;
    pointerFollowY = cursorBody.position.y;

    World.add(engine.world, [rock, cursorBody]);
    rebuildBounds();

    collisionSound = createCollisionSound(COLLISION_SOUND_PATH);
    Events.on(engine, "collisionStart", (event) => {
      for (const pair of event.pairs) {
        if (!isRockContact(pair.bodyA, pair.bodyB)) {
          continue;
        }

        lastCollisionSoundAt = playCollisionSound(collisionSound, lastCollisionSoundAt);
        break;
      }
    });

    boundsObserver = new ResizeObserver(() => {
      rebuildBounds();
    });
    boundsObserver.observe(container);
    sceneReady = true;
  };

  p.mousePressed = () => {
    unlockCollisionSound(collisionSound);
    pokeElapsedMs = 0;
    pokeImpulseApplied = false;
  };

  p.draw = () => {
    if (!sceneReady || !engine || !rock || !cursorBody) {
      return;
    }

    pointerFollowX = p.lerp(pointerFollowX, p.mouseX, CURSOR_FOLLOW_LERP);
    pointerFollowY = p.lerp(pointerFollowY, p.mouseY, CURSOR_FOLLOW_LERP);

    const pointerX = pointerFollowX;
    const pointerY = pointerFollowY;
    const isPoking = pokeElapsedMs < POKE_DURATION_MS;

    if (isPoking) {
      pokeElapsedMs += p.deltaTime;
    }

    const extension = isPoking ? pokeAmount(pokeElapsedMs) : 0;
    const pokeTarget = pokeTargetPoint(pointerX, pointerY, rock);
    const cursorX = p.lerp(pointerX, pokeTarget.x, extension);
    const cursorY = p.lerp(pointerY, pokeTarget.y, extension);
    const deltaX = cursorX - previousPointerX;
    const deltaY = cursorY - previousPointerY;

    if (isPoking && extension > POKE_IMPULSE_EXTENSION_THRESHOLD && !pokeImpulseApplied) {
      applyPokeImpulse(rock, pointerX, pointerY);
      pokeImpulseApplied = true;
    }

    const frameDeltaMs = p.deltaTime > 0 ? p.deltaTime : ENGINE_TIMESTEP_MS;

    advanceCursorContact(
      engine,
      rock,
      cursorBody,
      previousPointerX,
      previousPointerY,
      cursorX,
      cursorY,
      frameDeltaMs
    );

    previousPointerX = cursorX;
    previousPointerY = cursorY;

    refreshPlayBounds();
    drawPageBackground(p, layoutBounds, boxSprite);
    drawRock(p, rock, rockSprite);
    drawCursorCollider(p, cursorBody);
    drawCustomCursor(p, rock, cursorX, cursorY, pointerX, pointerY);
  };

  p.windowResized = () => {
    if (!container) {
      return;
    }

    resizeScene();
  };
};

new p5(sketch);
