import p5 from "https://cdn.jsdelivr.net/npm/p5@2.2.3/+esm";
import Matter from "https://cdn.jsdelivr.net/npm/matter-js@0.20.0/+esm";

const { Engine, Bodies, Body, Composite, Events, World, Common, Vertices } = Matter;

const COLLISION = {
  ROCK: 0x0002,
  BOUNDS: 0x0004,
  CURSOR: 0x0008,
};

const ROCK_COLLISION_FILTER = {
  category: COLLISION.ROCK,
  mask: 0xFFFFFFFF,
  group: 0,
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
const MAX_SPLITS_PER_FRAME = 1;
const MIN_COLLISION_IMPACT_SPEED = 2.5;
const ROCK_COLLISION_COUNT_COOLDOWN_MS = 120;
const CURSOR_MAX_SWEEP_SAMPLES = 6;
const COLLISION_SOUND_PITCH_MIN = 0.85;
const COLLISION_SOUND_PITCH_MAX = 1.15;
const ROCK_CONTACT_LABELS = new Set(["cursor", "bound", "bound-floor"]);
const ROCK_BASE_DISPLAY_WIDTH = 118;
const ROCK_INITIAL_SIZE_SCALE = 2.5;
const ROCK_DISPLAY_WIDTH = ROCK_BASE_DISPLAY_WIDTH * ROCK_INITIAL_SIZE_SCALE;
const ROCK_FALLBACK_ASPECT = 0.84;
const ROCK_COLLISIONS_BASE = 28;
const ROCK_COLLISION_PER_GENERATION = 10;
const MAX_ROCK_FRAGMENTS = 250;
const ROCK_SPLIT_COUNT_MIN = 2;
const ROCK_SPLIT_COUNT_MAX = 5;
const ROCK_MIN_DISPLAY_WIDTH = 10;
const ROCK_MIN_FRAGMENT_AREA = 90;
const ROCK_OUTLINE_INSET = 1;
const ROCK_OUTLINE_SAMPLE_WIDTH = 96;
const ROCK_OUTLINE_ALPHA_THRESHOLD = 48;
const ROCK_OUTLINE_SIMPLIFY_TARGET = 28;
const ROCK_SPLIT_SPAWN_OFFSET_RATIO = 0.38;
const ROCK_SPRITE_MIN_PIXEL_WIDTH = 8;
const ROCK_BODY_SLOP = 0.02;
const ROCK_SPLIT_SPAWN_SEPARATION_IMPULSE = 0.0045;
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
const ROCK_RESTITUTION_LARGE = 0.34;
const ROCK_RESTITUTION_SMALL = 0.14;
const ROCK_FRICTION_LARGE = 0.42;
const ROCK_FRICTION_SMALL = 0.92;
const ROCK_FRICTION_STATIC_LARGE = 0.38;
const ROCK_FRICTION_STATIC_SMALL = 0.88;
const ROCK_FRICTION_AIR_LARGE = 0.008;
const ROCK_FRICTION_AIR_SMALL = 0.045;
const ROCK_PHYSICS_SIZE_CURVE = 0.5;

const CURSOR_RADIUS = 22;
const CURSOR_DENSITY = 0.2;
const CURSOR_SURFACE_FRICTION = 0.1;
const CURSOR_FRICTION_STATIC = 0.5;
const CURSOR_RESTITUTION = 0.08;

const GRAVITY_Y = 0.9;
const ENGINE_TIMESTEP_MS = 1000 / 60;
const ENGINE_POSITION_ITERATIONS = 12;
const ENGINE_VELOCITY_ITERATIONS = 8;
const MAX_PIXEL_DENSITY = 2;

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

function isRockCollision(bodyA, bodyB) {
  const rockStateA = getRockStateForBody(bodyA);
  const rockStateB = getRockStateForBody(bodyB);

  if (!rockStateA && !rockStateB) {
    return false;
  }

  if (rockStateA && rockStateB && rockStateA === rockStateB) {
    return false;
  }

  if (rockStateA && ROCK_CONTACT_LABELS.has(bodyB.label)) {
    return true;
  }

  if (rockStateB && ROCK_CONTACT_LABELS.has(bodyA.label)) {
    return true;
  }

  return Boolean(rockStateA && rockStateB);
}

function getRockStateForBody(body) {
  if (!body) {
    return null;
  }

  const visited = new Set();
  let current = body;

  while (current) {
    if (current.rockState) {
      return current.rockState;
    }

    const currentId = current.id;

    if (currentId !== undefined) {
      if (visited.has(currentId)) {
        break;
      }

      visited.add(currentId);
    }

    const parent = current.parent;

    if (!parent || parent === current) {
      break;
    }

    current = parent;
  }

  return null;
}

function getRocksInCollision(bodyA, bodyB) {
  const rocks = [];
  const rockStateA = getRockStateForBody(bodyA);
  const rockStateB = getRockStateForBody(bodyB);

  if (rockStateA) {
    rocks.push(rockStateA);
  }

  if (rockStateB && rockStateB !== rockStateA) {
    rocks.push(rockStateB);
  }

  return rocks;
}

function randomInt(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function getCollisionsNeededToSplit(splitGeneration) {
  return ROCK_COLLISIONS_BASE + splitGeneration * ROCK_COLLISION_PER_GENERATION;
}

function getRockSizeRatio(displayWidth) {
  return Math.max(displayWidth / ROCK_DISPLAY_WIDTH, ROCK_MIN_DISPLAY_WIDTH / ROCK_DISPLAY_WIDTH);
}

function getRockPhysicsProfile(displayWidth) {
  const sizeRatio = getRockSizeRatio(displayWidth);
  const smallPieceBlend = 1 - Math.pow(sizeRatio, ROCK_PHYSICS_SIZE_CURVE);

  return {
    density: ROCK_DENSITY,
    restitution: ROCK_RESTITUTION_LARGE
      + (ROCK_RESTITUTION_SMALL - ROCK_RESTITUTION_LARGE) * smallPieceBlend,
    friction: ROCK_FRICTION_LARGE
      + (ROCK_FRICTION_SMALL - ROCK_FRICTION_LARGE) * smallPieceBlend,
    frictionStatic: ROCK_FRICTION_STATIC_LARGE
      + (ROCK_FRICTION_STATIC_SMALL - ROCK_FRICTION_STATIC_LARGE) * smallPieceBlend,
    frictionAir: ROCK_FRICTION_AIR_LARGE
      + (ROCK_FRICTION_AIR_SMALL - ROCK_FRICTION_AIR_LARGE) * smallPieceBlend,
  };
}

function getRockBodyParts(body) {
  if (body.parts?.length) {
    return body.parts;
  }

  return [body];
}

function getRockCollisionFilter() {
  return {
    category: ROCK_COLLISION_FILTER.category,
    mask: ROCK_COLLISION_FILTER.mask,
    group: ROCK_COLLISION_FILTER.group,
  };
}

function finalizeRockBody(body) {
  const collisionFilter = getRockCollisionFilter();

  Body.set(body, {
    label: "rock",
    collisionFilter,
  });

  for (const part of getRockBodyParts(body)) {
    Body.set(part, {
      label: "rock",
      collisionFilter,
    });
  }
}

function applyRockPhysics(body, displayWidth) {
  const profile = getRockPhysicsProfile(displayWidth);
  const collisionFilter = getRockCollisionFilter();

  for (const part of getRockBodyParts(body)) {
    Body.set(part, {
      ...profile,
      label: "rock",
      slop: ROCK_BODY_SLOP,
      collisionFilter,
    });
  }

  finalizeRockBody(body);
}

function linkRockStateToBody(body, rockState) {
  for (const part of getRockBodyParts(body)) {
    part.rockState = rockState;
    part.label = "rock";
  }
}

function clearRockStateFromBody(body) {
  for (const part of getRockBodyParts(body)) {
    delete part.rockState;
  }
}

function polygonArea(vertices) {
  if (vertices.length < 3) {
    return 0;
  }

  let area = 0;

  for (let index = 0; index < vertices.length; index += 1) {
    const nextIndex = (index + 1) % vertices.length;
    area += vertices[index].x * vertices[nextIndex].y;
    area -= vertices[nextIndex].x * vertices[index].y;
  }

  return Math.abs(area) * 0.5;
}

function polygonCentroid(vertices) {
  const area = polygonArea(vertices);

  if (area === 0) {
    return { x: vertices[0].x, y: vertices[0].y };
  }

  let cx = 0;
  let cy = 0;

  for (let index = 0; index < vertices.length; index += 1) {
    const nextIndex = (index + 1) % vertices.length;
    const cross = vertices[index].x * vertices[nextIndex].y
      - vertices[nextIndex].x * vertices[index].y;
    cx += (vertices[index].x + vertices[nextIndex].x) * cross;
    cy += (vertices[index].y + vertices[nextIndex].y) * cross;
  }

  const scale = 1 / (6 * area);

  return { x: cx * scale, y: cy * scale };
}

function polygonBBox(vertices) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const vertex of vertices) {
    minX = Math.min(minX, vertex.x);
    minY = Math.min(minY, vertex.y);
    maxX = Math.max(maxX, vertex.x);
    maxY = Math.max(maxY, vertex.y);
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function localToWorld(point, position, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  return {
    x: position.x + (point.x * cos) - (point.y * sin),
    y: position.y + (point.x * sin) + (point.y * cos),
  };
}

function worldToLocal(point, position, angle) {
  const dx = point.x - position.x;
  const dy = point.y - position.y;
  const cos = Math.cos(-angle);
  const sin = Math.sin(-angle);

  return {
    x: (dx * cos) - (dy * sin),
    y: (dx * sin) + (dy * cos),
  };
}

function getRockOutlineFromNormalized(displayWidth, displayHeight) {
  return ROCK_OUTLINE_NORMALIZED.map(({ x, y }) => ({
    x: (x - 0.5) * displayWidth * ROCK_OUTLINE_INSET,
    y: (y - 0.5) * displayHeight * ROCK_OUTLINE_INSET,
  }));
}

function isAlphaEdgePixel(pixels, width, height, x, y, threshold) {
  const alphaAt = (sampleX, sampleY) => {
    if (sampleX < 0 || sampleY < 0 || sampleX >= width || sampleY >= height) {
      return 0;
    }

    return pixels[(sampleY * width + sampleX) * 4 + 3];
  };

  if (alphaAt(x, y) < threshold) {
    return false;
  }

  return (
    alphaAt(x - 1, y) < threshold
    || alphaAt(x + 1, y) < threshold
    || alphaAt(x, y - 1) < threshold
    || alphaAt(x, y + 1) < threshold
  );
}

function convexHull(points) {
  if (points.length <= 2) {
    return points.map((point) => ({ x: point.x, y: point.y }));
  }

  const sorted = points.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (origin, a, b) => (
    ((a.x - origin.x) * (b.y - origin.y)) - ((a.y - origin.y) * (b.x - origin.x))
  );
  const lower = [];

  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) {
      lower.pop();
    }

    lower.push(point);
  }

  const upper = [];

  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    const point = sorted[index];

    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) {
      upper.pop();
    }

    upper.push(point);
  }

  upper.pop();
  lower.pop();

  return lower.concat(upper).map((point) => ({ x: point.x, y: point.y }));
}

function simplifyOutlineByAngle(points, targetCount) {
  const centroid = polygonCentroid(points);
  const sorted = points.slice().sort((a, b) => (
    Math.atan2(a.y - centroid.y, a.x - centroid.x)
    - Math.atan2(b.y - centroid.y, b.x - centroid.x)
  ));
  const simplified = [];
  const step = sorted.length / targetCount;

  for (let index = 0; index < targetCount; index += 1) {
    simplified.push(sorted[Math.min(sorted.length - 1, Math.floor(index * step))]);
  }

  return simplified;
}

function buildRockShapeOutline(p, sprite, displayWidth, displayHeight) {
  if (!sprite || sprite.width <= 0 || !p) {
    return getRockOutlineFromNormalized(displayWidth, displayHeight);
  }

  const sampleHeight = Math.max(16, Math.round(ROCK_OUTLINE_SAMPLE_WIDTH * (displayHeight / displayWidth)));
  const sampleGraphics = p.createGraphics(ROCK_OUTLINE_SAMPLE_WIDTH, sampleHeight);

  sampleGraphics.pixelDensity(1);
  sampleGraphics.clear();
  sampleGraphics.image(sprite, 0, 0, ROCK_OUTLINE_SAMPLE_WIDTH, sampleHeight);
  sampleGraphics.loadPixels();

  const edgePoints = [];

  for (let y = 0; y < sampleHeight; y += 1) {
    for (let x = 0; x < ROCK_OUTLINE_SAMPLE_WIDTH; x += 1) {
      if (!isAlphaEdgePixel(
        sampleGraphics.pixels,
        ROCK_OUTLINE_SAMPLE_WIDTH,
        sampleHeight,
        x,
        y,
        ROCK_OUTLINE_ALPHA_THRESHOLD
      )) {
        continue;
      }

      edgePoints.push({
        x: ((x + 0.5) / ROCK_OUTLINE_SAMPLE_WIDTH - 0.5) * displayWidth,
        y: ((y + 0.5) / sampleHeight - 0.5) * displayHeight,
      });
    }
  }

  sampleGraphics.remove();

  if (edgePoints.length < 8) {
    return getRockOutlineFromNormalized(displayWidth, displayHeight);
  }

  const outerHull = convexHull(edgePoints);

  return simplifyOutlineByAngle(outerHull, ROCK_OUTLINE_SIMPLIFY_TARGET);
}

function getRockOutlinePolygon(rockState) {
  return getRockVerticesLocal(rockState).map((vertex) => ({ x: vertex.x, y: vertex.y }));
}

function signedPolygonArea(vertices) {
  let area = 0;

  for (let index = 0; index < vertices.length; index += 1) {
    const nextIndex = (index + 1) % vertices.length;
    area += vertices[index].x * vertices[nextIndex].y;
    area -= vertices[nextIndex].x * vertices[index].y;
  }

  return area * 0.5;
}

function normalizePolygonForClip(vertices) {
  const normalized = vertices.map((vertex) => ({ x: vertex.x, y: vertex.y }));

  if (signedPolygonArea(normalized) < 0) {
    return normalized.reverse();
  }

  return normalized;
}

function clipPolygon(subject, clip) {
  if (!subject.length || !clip.length) {
    return [];
  }

  const normalizedSubject = normalizePolygonForClip(subject);
  const normalizedClip = normalizePolygonForClip(clip);
  let output = normalizedSubject.map((vertex) => ({ x: vertex.x, y: vertex.y }));

  for (let clipIndex = 0; clipIndex < normalizedClip.length; clipIndex += 1) {
    const input = output;
    output = [];
    const clipStart = normalizedClip[clipIndex];
    const clipEnd = normalizedClip[(clipIndex + 1) % normalizedClip.length];

    for (let inputIndex = 0; inputIndex < input.length; inputIndex += 1) {
      const inputStart = input[inputIndex];
      const inputEnd = input[(inputIndex + 1) % input.length];
      const inputStartInside = isLeftOfEdge(inputStart, clipStart, clipEnd);
      const inputEndInside = isLeftOfEdge(inputEnd, clipStart, clipEnd);

      if (inputEndInside) {
        if (!inputStartInside) {
          output.push(intersectSegments(inputStart, inputEnd, clipStart, clipEnd));
        }

        output.push(inputEnd);
      } else if (inputStartInside) {
        output.push(intersectSegments(inputStart, inputEnd, clipStart, clipEnd));
      }
    }
  }

  return output;
}

function isLeftOfEdge(point, edgeStart, edgeEnd) {
  return ((edgeEnd.x - edgeStart.x) * (point.y - edgeStart.y))
    - ((edgeEnd.y - edgeStart.y) * (point.x - edgeStart.x)) >= 0;
}

function intersectSegments(a1, a2, b1, b2) {
  const denominator = ((a1.x - a2.x) * (b1.y - b2.y)) - ((a1.y - a2.y) * (b1.x - b2.x));

  if (Math.abs(denominator) < 1e-8) {
    return { x: a2.x, y: a2.y };
  }

  const aValue = (a1.x * a2.y) - (a1.y * a2.x);
  const bValue = (b1.x * b2.y) - (b1.y * b2.x);

  return {
    x: ((aValue * (b1.x - b2.x)) - ((a1.x - a2.x) * bValue)) / denominator,
    y: ((aValue * (b1.y - b2.y)) - ((a1.y - a2.y) * bValue)) / denominator,
  };
}

function createWedgePolygon(centroid, startAngle, endAngle, radius, arcSegments = 10) {
  const vertices = [{ x: centroid.x, y: centroid.y }];
  const angleSpan = endAngle - startAngle;

  for (let segmentIndex = 0; segmentIndex <= arcSegments; segmentIndex += 1) {
    const angle = startAngle + (angleSpan * segmentIndex) / arcSegments;

    vertices.push({
      x: centroid.x + Math.cos(angle) * radius,
      y: centroid.y + Math.sin(angle) * radius,
    });
  }

  return vertices;
}

function computeRadialFragments(outline, count) {
  const centroid = polygonCentroid(outline);
  const bbox = polygonBBox(outline);
  const wedgeRadius = Math.max(bbox.width, bbox.height) * 2;
  const fragments = [];

  for (let sliceIndex = 0; sliceIndex < count; sliceIndex += 1) {
    const sliceStart = -Math.PI + (sliceIndex / count) * Math.PI * 2;
    const sliceEnd = -Math.PI + ((sliceIndex + 1) / count) * Math.PI * 2;
    const wedge = createWedgePolygon(centroid, sliceStart, sliceEnd, wedgeRadius);
    const clipped = clipPolygon(outline, wedge);

    if (clipped.length >= 3 && polygonArea(clipped) >= ROCK_MIN_FRAGMENT_AREA) {
      fragments.push(clipped);
    }
  }

  return fragments;
}

function computeFractureFragments(outline, splitCount) {
  let fragments = computeRadialFragments(outline, splitCount);

  if (fragments.length >= ROCK_SPLIT_COUNT_MIN) {
    return fragments;
  }

  for (let attemptCount = splitCount + 1; attemptCount <= ROCK_SPLIT_COUNT_MAX; attemptCount += 1) {
    fragments = computeRadialFragments(outline, attemptCount);

    if (fragments.length >= ROCK_SPLIT_COUNT_MIN) {
      return fragments;
    }
  }

  return fragments;
}

function getFragmentWorldVertices(rockState) {
  const { body, fragmentVertices } = rockState;
  const cos = Math.cos(body.angle);
  const sin = Math.sin(body.angle);

  return fragmentVertices.map((vertex) => ({
    x: body.position.x + (vertex.x * cos) - (vertex.y * sin),
    y: body.position.y + (vertex.x * sin) + (vertex.y * cos),
  }));
}

function getRemainingFragmentSlots(rockStates) {
  return MAX_ROCK_FRAGMENTS - rockStates.length + 1;
}

function getSplitCountForRock(rockStates) {
  const remaining = getRemainingFragmentSlots(rockStates);

  if (remaining < ROCK_SPLIT_COUNT_MIN) {
    return 0;
  }

  return Math.min(randomInt(ROCK_SPLIT_COUNT_MIN, ROCK_SPLIT_COUNT_MAX), remaining);
}

function canRockSplit(rockState, rockStates) {
  if (getSplitCountForRock(rockStates) < ROCK_SPLIT_COUNT_MIN) {
    return false;
  }

  const outline = getRockOutlinePolygon(rockState);
  const pieceArea = polygonArea(outline) / ROCK_SPLIT_COUNT_MAX;

  return pieceArea >= ROCK_MIN_FRAGMENT_AREA;
}

function shouldQueueRockSplit(rockState, rockStates) {
  return (
    canRockSplit(rockState, rockStates)
    && rockState.collisionCount >= getCollisionsNeededToSplit(rockState.splitGeneration)
  );
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

function getRockVerticesLocal(rockState) {
  if (rockState.fragmentVertices?.length >= 3) {
    return rockState.fragmentVertices;
  }

  return getRockOutlineFromNormalized(rockState.displayWidth, rockState.displayHeight);
}

function cloneVertices(vertices) {
  return vertices.map((vertex) => ({ x: vertex.x, y: vertex.y }));
}

function getPhysicsVertices(localVertices) {
  if (localVertices.length < 3) {
    return cloneVertices(localVertices);
  }

  const points = localVertices.map((vertex) => ({ x: vertex.x, y: vertex.y }));

  return Vertices.clockwiseSort(Vertices.hull(points));
}

function getLocalCursorPoint(rockState, cursorX, cursorY) {
  const { body } = rockState;
  const dx = cursorX - body.position.x;
  const dy = cursorY - body.position.y;
  const cos = Math.cos(-body.angle);
  const sin = Math.sin(-body.angle);

  return {
    x: (dx * cos) - (dy * sin),
    y: (dx * sin) + (dy * cos),
  };
}

function isPointInPolygon(x, y, vertices) {
  let inside = false;

  for (let index = 0, previousIndex = vertices.length - 1; index < vertices.length; previousIndex = index, index += 1) {
    const xi = vertices[index].x;
    const yi = vertices[index].y;
    const xj = vertices[previousIndex].x;
    const yj = vertices[previousIndex].y;
    const intersects = ((yi > y) !== (yj > y))
      && (x < (((xj - xi) * (y - yi)) / (yj - yi)) + xi);

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function distancePointToPolygonEdges(x, y, vertices) {
  let minDistance = Infinity;

  for (let index = 0; index < vertices.length; index += 1) {
    const nextIndex = (index + 1) % vertices.length;
    const ax = vertices[index].x;
    const ay = vertices[index].y;
    const bx = vertices[nextIndex].x;
    const by = vertices[nextIndex].y;
    const edgeX = bx - ax;
    const edgeY = by - ay;
    const lengthSq = (edgeX * edgeX) + (edgeY * edgeY);

    if (lengthSq === 0) {
      continue;
    }

    const t = Math.max(0, Math.min(1, (((x - ax) * edgeX) + ((y - ay) * edgeY)) / lengthSq));
    const closestX = ax + (edgeX * t);
    const closestY = ay + (edgeY * t);
    const distance = Math.hypot(x - closestX, y - closestY);

    minDistance = Math.min(minDistance, distance);
  }

  return minDistance;
}

function centerVerticesOnOrigin(vertices) {
  const centroid = polygonCentroid(vertices);

  return {
    centroid,
    vertices: vertices.map((vertex) => ({
      x: vertex.x - centroid.x,
      y: vertex.y - centroid.y,
    })),
  };
}

function syncRockStateShape(rockState) {
  if (!rockState.fragmentVertices?.length) {
    return rockState;
  }

  const bbox = polygonBBox(rockState.fragmentVertices);

  rockState.displayWidth = bbox.width;
  rockState.displayHeight = bbox.height;

  return rockState;
}

function getCursorRockOverlap(rockState, cursorX, cursorY) {
  const { x: localX, y: localY } = getLocalCursorPoint(rockState, cursorX, cursorY);
  const vertices = getRockVerticesLocal(rockState);
  const edgeDistance = distancePointToPolygonEdges(localX, localY, vertices);
  const surfaceClearance = isPointInPolygon(localX, localY, vertices) ? edgeDistance : -edgeDistance;

  return CURSOR_RADIUS + surfaceClearance;
}

function isRockNearPoint(rockState, x, y, margin = 0) {
  return getCursorRockOverlap(rockState, x, y) + margin > 0;
}

function getPairImpactSpeed(bodyA, bodyB) {
  const relativeVelocityX = bodyB.velocity.x - bodyA.velocity.x;
  const relativeVelocityY = bodyB.velocity.y - bodyA.velocity.y;

  return Math.hypot(relativeVelocityX, relativeVelocityY);
}

function getClosestRockState(rockStates, x, y) {
  let closestRockState = null;
  let closestDistance = Number.POSITIVE_INFINITY;

  for (const rockState of rockStates) {
    const dx = rockState.body.position.x - x;
    const dy = rockState.body.position.y - y;
    const distance = Math.hypot(dx, dy);

    if (distance < closestDistance) {
      closestDistance = distance;
      closestRockState = rockState;
    }
  }

  return closestRockState;
}

function createRockBodyFromFragment(worldCentroid, angle, localVertices, physicsSize) {
  const { centroid, vertices: centeredVertices } = centerVerticesOnOrigin(localVertices);
  const physicsVertices = getPhysicsVertices(centeredVertices);

  if (physicsVertices.length < 3) {
    return null;
  }

  const physics = getRockPhysicsProfile(physicsSize);
  const body = Bodies.fromVertices(
    worldCentroid.x,
    worldCentroid.y,
    [physicsVertices],
    {
      label: "rock",
      restitution: physics.restitution,
      friction: physics.friction,
      frictionStatic: physics.frictionStatic,
      frictionAir: physics.frictionAir,
      density: physics.density,
      slop: ROCK_BODY_SLOP,
      collisionFilter: getRockCollisionFilter(),
    },
    false
  );

  if (!body) {
    return null;
  }

  Body.setPosition(body, worldCentroid);
  Body.setAngle(body, angle);
  applyRockPhysics(body, physicsSize);
  finalizeRockBody(body);

  const fragmentVertices = cloneVertices(physicsVertices);
  const bbox = polygonBBox(fragmentVertices);

  return {
    body,
    fragmentVertices,
    displayWidth: bbox.width,
    displayHeight: bbox.height,
    textureCenterLocal: {
      x: -centroid.x,
      y: -centroid.y,
    },
  };
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

function getRockRenderExtents(rockState) {
  const worldVertices = rockState.fragmentVertices?.length >= 3
    ? getFragmentWorldVertices(rockState)
    : null;

  if (worldVertices) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const vertex of worldVertices) {
      minX = Math.min(minX, vertex.x);
      minY = Math.min(minY, vertex.y);
      maxX = Math.max(maxX, vertex.x);
      maxY = Math.max(maxY, vertex.y);
    }

    return { minX, minY, maxX, maxY };
  }

  const { body, displayWidth, displayHeight } = rockState;
  const halfW = displayWidth / 2;
  const halfH = displayHeight / 2;
  const cos = Math.abs(Math.cos(body.angle));
  const sin = Math.abs(Math.sin(body.angle));
  const extentX = halfW * cos + halfH * sin;
  const extentY = halfW * sin + halfH * cos;

  return {
    minX: body.position.x - extentX,
    minY: body.position.y - extentY,
    maxX: body.position.x + extentX,
    maxY: body.position.y + extentY,
  };
}

function clampRockCenterToPlayBounds(x, y, localVertices, angle, playBounds) {
  const { vertices: centeredVertices } = centerVerticesOnOrigin(localVertices);
  const cos = Math.abs(Math.cos(angle));
  const sin = Math.abs(Math.sin(angle));
  let extentX = 0;
  let extentY = 0;

  for (const vertex of centeredVertices) {
    extentX = Math.max(extentX, Math.abs(vertex.x * cos) + Math.abs(vertex.y * sin));
    extentY = Math.max(extentY, Math.abs(vertex.x * sin) + Math.abs(vertex.y * cos));
  }

  const minCenterX = playBounds.x + extentX;
  const minCenterY = playBounds.y + extentY;
  const maxCenterX = playBounds.x + playBounds.width - extentX;
  const maxCenterY = playBounds.y + playBounds.height - extentY;

  return {
    x: Math.min(Math.max(x, minCenterX), maxCenterX),
    y: Math.min(Math.max(y, minCenterY), maxCenterY),
  };
}

function clampRockStateToPlayBounds(rockState, playBounds) {
  const { body } = rockState;
  const { minX, minY, maxX, maxY } = getRockRenderExtents(rockState);
  const left = playBounds.x;
  const top = playBounds.y;
  const right = playBounds.x + playBounds.width;
  const bottom = playBounds.y + playBounds.height;

  let dx = 0;
  let dy = 0;

  if (minX < left) {
    dx = left - minX;
  } else if (maxX > right) {
    dx = right - maxX;
  }

  if (minY < top) {
    dy = top - minY;
  } else if (maxY > bottom) {
    dy = bottom - maxY;
  }

  if (dx === 0 && dy === 0) {
    return;
  }

  Body.setPosition(body, { x: body.position.x + dx, y: body.position.y + dy });

  const velocity = { x: body.velocity.x, y: body.velocity.y };

  if (dx > 0 && velocity.x < 0) {
    velocity.x = 0;
  } else if (dx < 0 && velocity.x > 0) {
    velocity.x = 0;
  }

  if (dy > 0 && velocity.y < 0) {
    velocity.y = 0;
  } else if (dy < 0 && velocity.y > 0) {
    velocity.y = 0;
  }

  Body.setVelocity(body, velocity);
}

function clampRockStatesToPlayBounds(rockStates, playBounds) {
  for (const rockState of rockStates) {
    clampRockStateToPlayBounds(rockState, playBounds);
  }
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

function applyCursorPush(rockState, cursorX, cursorY, deltaX, deltaY) {
  const rock = rockState.body;
  const overlap = getCursorRockOverlap(rockState, cursorX, cursorY);

  if (overlap <= 0) {
    return;
  }

  const dx = rock.position.x - cursorX;
  const dy = rock.position.y - cursorY;
  const distance = Math.hypot(dx, dy);

  if (distance === 0) {
    return;
  }

  const motion = Math.hypot(deltaX, deltaY);
  if (motion < CURSOR_PUSH_MIN_MOTION) {
    return;
  }
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

function advanceCursorContact(
  engine,
  rockStates,
  cursorBody,
  startX,
  startY,
  endX,
  endY,
  deltaMs,
  playBounds
) {
  const deltaX = endX - startX;
  const deltaY = endY - startY;
  const motion = Math.hypot(deltaX, deltaY);
  const sampleCount = motion < CURSOR_PUSH_MIN_MOTION
    ? 1
    : Math.min(CURSOR_MAX_SWEEP_SAMPLES, Math.max(1, Math.ceil(motion / CURSOR_SWEEP_SAMPLE_SPACING)));

  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
    const t = sampleCount === 1 ? 1 : (sampleIndex + 1) / sampleCount;
    const sampleX = startX + deltaX * t;
    const sampleY = startY + deltaY * t;
    const sampleDeltaX = deltaX / sampleCount;
    const sampleDeltaY = deltaY / sampleCount;

    syncCursorBody(cursorBody, sampleX, sampleY, sampleDeltaX, sampleDeltaY);

    for (const rockState of rockStates) {
      if (getCursorRockOverlap(rockState, sampleX, sampleY) > 0) {
        applyCursorPush(rockState, sampleX, sampleY, sampleDeltaX, sampleDeltaY);
      }
    }
  }

  Engine.update(engine, deltaMs);
  clampRockStatesToPlayBounds(rockStates, playBounds);
  syncCursorBody(cursorBody, endX, endY, deltaX, deltaY);
}

function getPrimaryRockState(rockStates) {
  if (!rockStates.length) {
    return null;
  }

  return rockStates.reduce((largest, rockState) => (
    rockState.displayWidth > largest.displayWidth ? rockState : largest
  ));
}

function removeRockState(engine, rockStates, rockState) {
  const index = rockStates.indexOf(rockState);

  if (index >= 0) {
    rockStates.splice(index, 1);
  }

  clearRockStateFromBody(rockState.body);
  Composite.remove(engine.world, rockState.body);
}

function registerRockState(rockStates, body, rockOptions) {
  const {
    displayWidth,
    displayHeight,
    splitGeneration = 0,
    fragmentVertices = null,
    textureSize = null,
    textureCenterLocal = { x: 0, y: 0 },
  } = rockOptions;
  const rockState = {
    body,
    displayWidth,
    displayHeight,
    splitGeneration,
    fragmentVertices,
    textureSize: textureSize ?? { width: displayWidth, height: displayHeight },
    textureCenterLocal,
    collisionCount: 0,
    lastSplitCollisionAt: 0,
  };

  linkRockStateToBody(body, rockState);
  syncRockStateShape(rockState);
  applyRockPhysics(body, rockState.displayWidth);
  rockStates.push(rockState);

  return rockState;
}

function splitRockState(engine, rockStates, rockState, playBounds) {
  const { body, displayWidth, displayHeight, splitGeneration } = rockState;

  if (!canRockSplit(rockState, rockStates)) {
    return false;
  }

  const splitCount = getSplitCountForRock(rockStates);

  if (splitCount < ROCK_SPLIT_COUNT_MIN) {
    return false;
  }

  const parentOutline = getRockOutlinePolygon(rockState);
  const fragments = computeFractureFragments(parentOutline, splitCount);

  if (fragments.length < ROCK_SPLIT_COUNT_MIN) {
    return false;
  }

  const parentPosition = body.position;
  const parentAngle = body.angle;
  const parentVelocity = { x: body.velocity.x, y: body.velocity.y };
  const angularVelocity = body.angularVelocity;
  const textureSize = rockState.textureSize ?? { width: displayWidth, height: displayHeight };
  const parentTextureCenter = rockState.textureCenterLocal ?? { x: 0, y: 0 };
  const imageCenterWorld = localToWorld(parentTextureCenter, parentPosition, parentAngle);
  const parentBBox = polygonBBox(parentOutline);
  const spawnOffset = Math.max(parentBBox.width, parentBBox.height) * ROCK_SPLIT_SPAWN_OFFSET_RATIO;
  const childSpawnPlans = [];

  for (let pieceIndex = 0; pieceIndex < fragments.length; pieceIndex += 1) {
    const fragmentOutline = fragments[pieceIndex];
    const fragmentCentroid = polygonCentroid(fragmentOutline);
    const worldCentroid = localToWorld(fragmentCentroid, parentPosition, parentAngle);
    const spreadAngle = (Math.PI * 2 * pieceIndex) / fragments.length + (Math.random() - 0.5) * 0.5;
    const separatedCentroid = {
      x: worldCentroid.x + Math.cos(spreadAngle) * spawnOffset,
      y: worldCentroid.y + Math.sin(spreadAngle) * spawnOffset,
    };
    const clampedCentroid = clampRockCenterToPlayBounds(
      separatedCentroid.x,
      separatedCentroid.y,
      fragmentOutline,
      parentAngle,
      playBounds
    );
    const fragmentBBoxEstimate = polygonBBox(fragmentOutline);
    const physicsSize = Math.max(
      fragmentBBoxEstimate.width,
      fragmentBBoxEstimate.height,
      Math.sqrt(fragmentBBoxEstimate.width * fragmentBBoxEstimate.height)
    );
    childSpawnPlans.push({
      worldCentroid: clampedCentroid,
      parentAngle,
      fragmentOutline,
      physicsSize,
      spreadAngle,
    });
  }

  if (childSpawnPlans.length < ROCK_SPLIT_COUNT_MIN) {
    return false;
  }

  removeRockState(engine, rockStates, rockState);

  let childrenCreated = 0;

  for (const spawnPlan of childSpawnPlans) {
    const {
      worldCentroid,
      parentAngle: pieceAngle,
      fragmentOutline,
      physicsSize,
      spreadAngle,
    } = spawnPlan;
    const fragment = createRockBodyFromFragment(
      worldCentroid,
      pieceAngle,
      fragmentOutline,
      physicsSize
    );

    if (!fragment) {
      continue;
    }

    const { body: childBody, fragmentVertices } = fragment;
    const pieceSizeRatio = physicsSize / Math.sqrt(displayWidth * displayHeight);
    const separationScale = Math.max(0.35, pieceSizeRatio);
    const separationX = Math.cos(spreadAngle) * ROCK_SPLIT_SPAWN_SEPARATION_IMPULSE * separationScale;
    const separationY = Math.sin(spreadAngle) * ROCK_SPLIT_SPAWN_SEPARATION_IMPULSE * separationScale;
    const spinScale = Math.sqrt(Math.max(displayWidth, displayHeight) / Math.max(physicsSize, 1));

    Body.setVelocity(childBody, {
      x: parentVelocity.x + (Math.random() - 0.5) * 1.2 * separationScale + separationX,
      y: parentVelocity.y + (Math.random() - 0.5) * 1.2 * separationScale + separationY,
    });
    Body.setAngularVelocity(
      childBody,
      (angularVelocity + (Math.random() - 0.5) * 0.12) * spinScale
    );
    Composite.add(engine.world, childBody);
    finalizeRockBody(childBody);

    const textureCenterLocal = worldToLocal(imageCenterWorld, childBody.position, childBody.angle);
    const childRockState = registerRockState(rockStates, childBody, {
      displayWidth: fragment.displayWidth,
      displayHeight: fragment.displayHeight,
      splitGeneration: splitGeneration + 1,
      fragmentVertices,
      textureSize,
      textureCenterLocal,
    });

    clampRockStateToPlayBounds(childRockState, playBounds);
    childrenCreated += 1;
  }

  return childrenCreated >= ROCK_SPLIT_COUNT_MIN;
}

function processPendingRockSplits(engine, rockStates, pendingSplits, playBounds) {
  const queuedSplits = [...pendingSplits];
  pendingSplits.clear();

  let splitsProcessed = 0;

  for (const rockState of queuedSplits) {
    if (splitsProcessed >= MAX_SPLITS_PER_FRAME) {
      pendingSplits.add(rockState);
      continue;
    }

    if (!rockStates.includes(rockState)) {
      continue;
    }

    if (rockState.collisionCount >= getCollisionsNeededToSplit(rockState.splitGeneration)) {
      const didSplit = splitRockState(engine, rockStates, rockState, playBounds);

      if (didSplit) {
        splitsProcessed += 1;
      } else {
        pendingSplits.add(rockState);
      }
    }
  }

  clampRockStatesToPlayBounds(rockStates, playBounds);
}

function getRockSpritePixelSize(displayWidth, sourceWidth, sourceHeight) {
  const sizeScale = displayWidth / ROCK_DISPLAY_WIDTH;
  const pixelWidth = Math.max(
    ROCK_SPRITE_MIN_PIXEL_WIDTH,
    Math.round(sourceWidth * sizeScale)
  );
  const pixelHeight = Math.max(
    ROCK_SPRITE_MIN_PIXEL_WIDTH,
    Math.round(sourceHeight * sizeScale)
  );

  return { pixelWidth, pixelHeight };
}

function getScaledRockSprite(p, rockSprite, displayWidth, displayHeight, spriteCache) {
  const { pixelWidth, pixelHeight } = getRockSpritePixelSize(
    displayWidth,
    rockSprite.width,
    rockSprite.height
  );
  const cacheKey = `${pixelWidth}x${pixelHeight}`;

  if (spriteCache.has(cacheKey)) {
    return spriteCache.get(cacheKey);
  }

  const scaledSprite = p.createGraphics(pixelWidth, pixelHeight);
  scaledSprite.pixelDensity(1);
  scaledSprite.noSmooth();
  scaledSprite.image(rockSprite, 0, 0, pixelWidth, pixelHeight);
  spriteCache.set(cacheKey, scaledSprite);

  return scaledSprite;
}

function drawRock(p, rockState, rockSprite, spriteCache) {
  const { body, textureSize, textureCenterLocal } = rockState;
  const { x, y } = body.position;
  const angle = body.angle;
  const drawVertices = getRockVerticesLocal(rockState);

  p.push();
  p.translate(x, y);
  p.rotate(angle);

  if (rockSprite && rockSprite.width > 0) {
    const textureWidth = textureSize.width;
    const textureHeight = textureSize.height;
    const scaledSprite = getScaledRockSprite(
      p,
      rockSprite,
      textureWidth,
      textureHeight,
      spriteCache
    );
    const usePixelScaling = textureWidth < ROCK_DISPLAY_WIDTH * 0.85;

    p.drawingContext.save();
    p.drawingContext.beginPath();
    p.drawingContext.moveTo(drawVertices[0].x, drawVertices[0].y);

    for (let vertexIndex = 1; vertexIndex < drawVertices.length; vertexIndex += 1) {
      p.drawingContext.lineTo(drawVertices[vertexIndex].x, drawVertices[vertexIndex].y);
    }

    p.drawingContext.closePath();
    p.drawingContext.clip();
    p.imageMode(p.CENTER);

    if (usePixelScaling) {
      p.noSmooth();
    }

    p.image(
      scaledSprite,
      textureCenterLocal.x,
      textureCenterLocal.y,
      textureWidth,
      textureHeight
    );

    if (usePixelScaling) {
      p.smooth();
    }

    p.drawingContext.restore();
  } else {
    p.noStroke();
    p.fill(92, 86, 78);
    p.beginShape();

    for (const vertex of drawVertices) {
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
  let rocks = [];
  let pendingRockSplits = new Set();
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
  let rockSpriteCache = new Map();
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

    if (rocks.length) {
      clampRockStatesToPlayBounds(rocks, playBounds);
    }
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
    engine.enableSleeping = false;

    if (typeof Common.setDecomp === "function") {
      Common.setDecomp(null);
    }

    refreshPlayBounds();
    const rockDisplay = getRockDisplaySize(rockSprite);
    const initialRockPosition = {
      x: playBounds.x + playBounds.width * ROCK_START_X_RATIO,
      y: playBounds.y + playBounds.height * ROCK_START_Y_RATIO,
    };
    const rockShapeOutline = buildRockShapeOutline(
      p,
      rockSprite,
      rockDisplay.width,
      rockDisplay.height
    );
    const initialFragment = createRockBodyFromFragment(
      initialRockPosition,
      0,
      rockShapeOutline,
      Math.sqrt(rockDisplay.width * rockDisplay.height)
    );

    if (!initialFragment) {
      console.error("Failed to create initial rock body");
      return;
    }

    const initialRockBody = initialFragment.body;
    const initialRockState = registerRockState(rocks, initialRockBody, {
      displayWidth: initialFragment.displayWidth,
      displayHeight: initialFragment.displayHeight,
      fragmentVertices: initialFragment.fragmentVertices,
      textureSize: { width: rockDisplay.width, height: rockDisplay.height },
      textureCenterLocal: initialFragment.textureCenterLocal,
    });
    clampRockStateToPlayBounds(initialRockState, playBounds);
    cursorBody = createCursorBody(
      playBounds.x + playBounds.width * CURSOR_START_X_RATIO,
      playBounds.y + playBounds.height * CURSOR_START_Y_RATIO
    );
    previousPointerX = cursorBody.position.x;
    previousPointerY = cursorBody.position.y;
    pointerFollowX = cursorBody.position.x;
    pointerFollowY = cursorBody.position.y;

    World.add(engine.world, [initialRockBody, cursorBody]);
    finalizeRockBody(initialRockBody);
    rebuildBounds();

    collisionSound = createCollisionSound(COLLISION_SOUND_PATH);

    function registerSplitCollision(rockState) {
      const now = performance.now();

      if (now - rockState.lastSplitCollisionAt < ROCK_COLLISION_COUNT_COOLDOWN_MS) {
        return;
      }

      rockState.lastSplitCollisionAt = now;
      rockState.collisionCount += 1;

      if (shouldQueueRockSplit(rockState, rocks)) {
        pendingRockSplits.add(rockState);
      }
    }

    Events.on(engine, "collisionStart", (event) => {
      let playedSound = false;
      const countedRocks = new Set();

      for (const pair of event.pairs) {
        if (!isRockCollision(pair.bodyA, pair.bodyB)) {
          continue;
        }

        const impactSpeed = getPairImpactSpeed(pair.bodyA, pair.bodyB);

        if (!playedSound && impactSpeed >= MIN_COLLISION_IMPACT_SPEED) {
          lastCollisionSoundAt = playCollisionSound(collisionSound, lastCollisionSoundAt);
          playedSound = true;
        }

        if (impactSpeed < MIN_COLLISION_IMPACT_SPEED) {
          continue;
        }

        for (const rockState of getRocksInCollision(pair.bodyA, pair.bodyB)) {
          if (countedRocks.has(rockState)) {
            continue;
          }

          countedRocks.add(rockState);
          registerSplitCollision(rockState);
        }
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
    if (!sceneReady || !engine || !rocks.length || !cursorBody) {
      return;
    }

    pointerFollowX = p.lerp(pointerFollowX, p.mouseX, CURSOR_FOLLOW_LERP);
    pointerFollowY = p.lerp(pointerFollowY, p.mouseY, CURSOR_FOLLOW_LERP);

    const pointerX = pointerFollowX;
    const pointerY = pointerFollowY;
    const interactionRockState = getClosestRockState(rocks, pointerX, pointerY)
      ?? getPrimaryRockState(rocks);
    const interactionRock = interactionRockState.body;
    const isPoking = pokeElapsedMs < POKE_DURATION_MS;

    if (isPoking) {
      pokeElapsedMs += p.deltaTime;
    }

    const extension = isPoking ? pokeAmount(pokeElapsedMs) : 0;
    const pokeTarget = pokeTargetPoint(pointerX, pointerY, interactionRock);
    const cursorX = p.lerp(pointerX, pokeTarget.x, extension);
    const cursorY = p.lerp(pointerY, pokeTarget.y, extension);
    const deltaX = cursorX - previousPointerX;
    const deltaY = cursorY - previousPointerY;

    if (isPoking && extension > POKE_IMPULSE_EXTENSION_THRESHOLD && !pokeImpulseApplied) {
      const pokeTargetRockState = getClosestRockState(rocks, pointerX, pointerY);

      if (
        pokeTargetRockState
        && isRockNearPoint(pokeTargetRockState, pointerX, pointerY, POKE_FORWARD_DISTANCE)
      ) {
        applyPokeImpulse(pokeTargetRockState.body, pointerX, pointerY);
      }

      pokeImpulseApplied = true;
    }

    refreshPlayBounds();

    const frameDeltaMs = p.deltaTime > 0 ? p.deltaTime : ENGINE_TIMESTEP_MS;

    advanceCursorContact(
      engine,
      rocks,
      cursorBody,
      previousPointerX,
      previousPointerY,
      cursorX,
      cursorY,
      frameDeltaMs,
      playBounds
    );

    processPendingRockSplits(engine, rocks, pendingRockSplits, playBounds);

    previousPointerX = cursorX;
    previousPointerY = cursorY;
    drawPageBackground(p, layoutBounds, boxSprite);

    for (const rockState of rocks) {
      drawRock(p, rockState, rockSprite, rockSpriteCache);
    }

    drawCursorCollider(p, cursorBody);
    drawCustomCursor(p, interactionRock, cursorX, cursorY, pointerX, pointerY);
  };

  p.windowResized = () => {
    if (!container) {
      return;
    }

    resizeScene();
  };
};

new p5(sketch);
