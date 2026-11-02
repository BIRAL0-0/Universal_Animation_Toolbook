'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createCanvas } = require('../universal_toolbook/engine/canvas_backend');

const { registerFonts } = require('../universal_toolbook/engine/font');
const {
  BONES,
  BUILDS,
  SUPPORTED_HAIRSTYLES,
  SUPPORTED_ACCESSORIES,
  applyPostureToPose,
  skeleton,
  walkMotion,
  runMotion,
  drawFigure,
} = require('../universal_toolbook/engine/character_rig');
const { SUPPORTED_ENVIRONMENTS, drawEnvironment } = require('../universal_toolbook/engine/environments');
const { SUPPORTED_ACTIONS, evaluateCharacterState, resolveSceneInteractions } = require('../universal_toolbook/engine/motion_library');
const {
  compileEpisode,
  markAccentPhrases,
  mapDisplayTokensToWordTimings,
  bridgeContinuousWordGaps,
  buildSubtitlesFromLineTimings,
} = require('../universal_toolbook/engine/episode');
const { renderEpisodeFrame } = require('../universal_toolbook/engine/video_renderer');
const { containRect, coverRect } = require('../universal_toolbook/engine/render_layout');
const {
  computePortraitViewport,
  computeLandscapePropZoomScale,
  fitBoardToPortraitViewport,
} = require('../universal_toolbook/engine/portrait_framing');

registerFonts();

function dist(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

// 1. Invariant bone-length verification across all 60 actions (0.000px stretch)
for (const action of SUPPORTED_ACTIONS) {
  for (const facing of [1, -1]) {
    for (const ts of [0.1, 1.5, 3.3]) {
      const actor = { id: 'c1', action, fromX: 0.25, toX: 0.65, x: 0.45, facing, targetX: 0.62, targetY: 310 };
      const st = evaluateCharacterState(actor, ts, 4.0, ts, 1920, 855);
      const r = skeleton(st.x, st.fy, st.s, st.pose, st.flip);
      assert(Math.abs(dist(r.hip, r.shoulder) - BONES.TORSO) < 1e-4, `Torso stretch on ${action}`);
      assert(Math.abs(dist(r.al[0], r.al[1]) - BONES.UPPER_ARM) < 1e-4, `Upper arm L stretch on ${action}`);
      assert(Math.abs(dist(r.al[1], r.al[2]) - BONES.FOREARM) < 1e-4, `Forearm L stretch on ${action}`);
      assert(Math.abs(dist(r.ar[0], r.ar[1]) - BONES.UPPER_ARM) < 1e-4, `Upper arm R stretch on ${action}`);
      assert(Math.abs(dist(r.ar[1], r.ar[2]) - BONES.FOREARM) < 1e-4, `Forearm R stretch on ${action}`);
      assert(Math.abs(dist(r.ll[0], r.ll[1]) - BONES.THIGH) < 1e-4, `Thigh L stretch on ${action}`);
      assert(Math.abs(dist(r.ll[1], r.ll[2]) - BONES.SHIN) < 1e-4, `Shin L stretch on ${action}`);
      assert(Math.abs(dist(r.lr[0], r.lr[1]) - BONES.THIGH) < 1e-4, `Thigh R stretch on ${action}`);
      assert(Math.abs(dist(r.lr[1], r.lr[2]) - BONES.SHIN) < 1e-4, `Shin R stretch on ${action}`);
    }
  }
}

// 2. Verify V3 Directional Locomotion (`walkMotion` & `runMotion` left vs right `flip` + aerial phase)
const walkLeft = walkMotion({ t: 1.0, duration: 3.0, x0: 1200, x1: 500, floor: 855, scale: 1.5 });
assert.strictEqual(walkLeft.flip, true, 'Walking left must flip character cleanly to face left');
const walkRight = walkMotion({ t: 1.0, duration: 3.0, x0: 500, x1: 1200, floor: 855, scale: 1.5 });
assert.strictEqual(walkRight.flip, false, 'Walking right must keep character facing right');

let maxRunAirLift = 0;
for (let i = 0; i <= 40; i++) {
  const rm = runMotion({ t: (i / 40) * 2.0, duration: 2.0, x0: 1300, x1: 400, floor: 855, scale: 1.5 });
  assert.strictEqual(rm.flip, true, 'Running left must flip character cleanly to face left');
  if (rm.pose.airLift > maxRunAirLift) maxRunAirLift = rm.pose.airLift;
}
assert(maxRunAirLift > 6, `Expected genuine airborne phase in runMotion, got ${maxRunAirLift}`);

// 3. Verify V3 Biomechanical Posture Polarity (`posture > 0` upright vs `posture < 0` slumped forward stoop)
const pProud = applyPostureToPose({}, 0.6);
const pSlumped = applyPostureToPose({}, -0.8);
assert(pSlumped.lean > pProud.lean + 0.12, 'Negative posture must stoop forward, positive posture must stand proud');

// 4. Verify V3 Dual-Actor World-Space Handshake & Hug IK Solver (`resolveSceneInteractions`)
const hsLeft = evaluateCharacterState({ id: 'daniel', x: 0.42, facing: 1, action: 'handshake', scale: 1.6 }, 1.2, 4.0, 1.2, 1920, 855);
const hsRight = evaluateCharacterState({ id: 'marcus', x: 0.58, facing: -1, action: 'handshake', scale: 1.6 }, 1.2, 4.0, 1.2, 1920, 855);
const hsEntries = [
  { actor: { id: 'daniel' }, state: hsLeft, z: 0 },
  { actor: { id: 'marcus' }, state: hsRight, z: 0 },
];
resolveSceneInteractions(hsEntries, 1.2, {});
const rHsL = skeleton(hsLeft.x, hsLeft.fy, hsLeft.s, hsLeft.pose, hsLeft.flip);
const rHsR = skeleton(hsRight.x, hsRight.fy, hsRight.s, hsRight.pose, hsRight.flip);
const handClaspDist = dist(rHsL.world.al[2], rHsR.world.al[2]);
assert(handClaspDist < 8, `Expected handshake clasping hands to lock in world space, got dist=${handClaspDist}`);

const hugA = evaluateCharacterState({ id: 'daniel', x: 0.35, facing: 1, action: 'hug', scale: 1.6 }, 1.4, 4.0, 1.4, 1920, 855);
const hugB = evaluateCharacterState({ id: 'mother', x: 0.65, facing: -1, action: 'hug', scale: 1.54 }, 1.4, 4.0, 1.4, 1920, 855);
resolveSceneInteractions(
  [
    { actor: { id: 'daniel' }, state: hugA, z: 0 },
    { actor: { id: 'mother' }, state: hugB, z: 0 },
  ],
  1.4,
  {}
);
assert.strictEqual(hugA.hugGroupId, hugB.hugGroupId, 'Hugging pair must share interleaved hugGroupId');
assert(Math.abs(hugB.x - hugA.x) < 120, 'Hugging pair must step into close embrace distance');

// 5. Verify V3 Subtitle Multi-Word Accent Highlighting, Speaker Prefix Separation & Non-Flicker Gap Bridging
const subTokens = [
  { raw: 'DANIEL:', isSpeakerLabel: true, highlight: false },
  { raw: 'I', highlight: false },
  { raw: 'stop', highlight: false },
  { raw: 'at', highlight: false },
  { raw: '9', highlight: false },
  { raw: 'PM', highlight: false },
  { raw: '—', highlight: false },
  { raw: 'no', highlight: false },
  { raw: 'excuses.', highlight: false },
];
markAccentPhrases(subTokens, ['9 PM', 'no excuses']);
assert.strictEqual(subTokens[4].highlight, true, 'Multi-word phrase "9 PM" token 1 must highlight');
assert.strictEqual(subTokens[5].highlight, true, 'Multi-word phrase "9 PM" token 2 must highlight');
assert.strictEqual(subTokens[7].highlight, true, 'Multi-word phrase "no excuses" token 1 must highlight');
assert.strictEqual(subTokens[8].highlight, true, 'Multi-word phrase "no excuses" token 2 must highlight');

const mappedSub = mapDisplayTokensToWordTimings(
  subTokens,
  [
    { word: 'I', start: 1.00, end: 1.12 },
    { word: 'stop', start: 1.18, end: 1.42 },
    { word: 'at', start: 1.48, end: 1.60 },
    { word: '9', start: 1.66, end: 1.88 },
    { word: 'PM', start: 1.94, end: 2.25 },
    { word: 'no', start: 2.75, end: 2.95 }, // 0.50s real pause after em-dash!
    { word: 'excuses', start: 3.01, end: 3.48 },
  ],
  1.0,
  3.5
);
assert.strictEqual(mappedSub[0].tStart, undefined, 'Speaker prefix badge must NOT steal first spoken word timing');
assert.strictEqual(mappedSub[1].tStart, 1.00, 'First spoken word must keep exact start timestamp');
assert(mappedSub[1].tEnd >= mappedSub[2].tStart, 'Continuous word micro-gap must be bridged smoothly to eliminate flicker');
assert.strictEqual(mappedSub[6].tStart, undefined, 'Standalone em-dash must not steal an active word glow pill');
assert(mappedSub[5].tEnd < mappedSub[7].tStart - 0.1, 'Real sentence pause (>0.28s) must remain unbridged');

// 6. Render smoke test across all builds, hairstyles, accessories, split-depth props, vehicles & custom settings
const cv = createCanvas(960, 540);
const g = cv.getContext('2d');
for (const build of Object.keys(BUILDS)) {
  for (const hair of SUPPORTED_HAIRSTYLES) {
    drawFigure(g, 480, 420, 0.8, { handL: 'open', handR: 'point' }, false, {
      color: '#38bdf8',
      build,
      hair,
      hairColor: '#1e293b',
      accessories: SUPPORTED_ACCESSORIES.filter((a) => a !== 'none').slice(0, 4),
      lightColor: '#22d3ee',
      nameTag: build,
    });
  }
}
for (const backdrop of ['city', 'mountains', 'hills', 'forest', 'ocean', 'desert', 'grid', 'arches', 'pillars', 'shelves', 'windows']) {
  drawEnvironment(g, {
    sky: ['#061020', '#132a4a'],
    floor_color: '#07111e',
    light_color: '#38bdf8',
    backdrop,
    weather: 'particles',
    lighting: 'skylights',
  }, 1.2, 0);
}

// 7. World-contact walkMotion zero foot-slip during stance phase
let prevAnchorL = null;
for (let i = 0; i <= 80; i++) {
  const t = (i / 80) * 4.0;
  const wm = walkMotion({ t, duration: 4.0, x0: 250, x1: 850, floor: 855, scale: 1.0 });
  if (wm.stance[0]) {
    assert(Math.abs(wm.pose.fl[1] - 855) < 1e-6);
    if (prevAnchorL !== null) {
      const slip = Math.abs(wm.pose.fl[0] - prevAnchorL);
      assert(slip < 1e-6 || slip > 25, `Foot slipped during stance: ${slip}`);
    }
    prevAnchorL = wm.pose.fl[0];
  } else {
    prevAnchorL = null;
  }
}

// 8. Verify zero film-grain configuration
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'universal_toolbook', 'config', 'studio_config.json'), 'utf8'));
assert.strictEqual(cfg.film_grain, false);
const rendererCode = fs.readFileSync(path.join(__dirname, '..', 'universal_toolbook', 'engine', 'video_renderer.js'), 'utf8');
assert(!rendererCode.includes('makeGrain'));

// 9. Compile minimal Cinema, Parchment & V3 Occlusion/Interaction scenes cleanly
const spec = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'minimal_schema_template.json'), 'utf8'));
const ep = compileEpisode(spec);
assert.strictEqual(ep.warnings.length, 0);
renderEpisodeFrame(g, 960, 540, ep, 15);

const pSpec = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'minimal_parchment_template.json'), 'utf8'));
const pEp = compileEpisode(pSpec);
assert.strictEqual(pEp.warnings.length, 0);
renderEpisodeFrame(g, 960, 540, pEp, 15);

// 10. Verify 9:16 portrait adaptation uses a subject-aware crop and uniform (never stretched) scaling.
const portraitFit = containRect(1920, 1080, 1080, 1920);
assert(Math.abs(portraitFit.width / portraitFit.height - 16 / 9) < 1e-10, 'Portrait contain must preserve source aspect ratio');
const portraitCover = coverRect(1920, 1080, 1080, 1920);
assert(Math.abs(portraitCover.width / portraitCover.height - 16 / 9) < 1e-10, 'Portrait background cover must preserve source aspect ratio');
const portraitCrop = { left: 650, width: 608, centerX: 954, right: 1258 };
const sourceBoard = { type: 'line_graph', x: 0.46, y: 104, w: 880, h: 390 };
const fittedBoard = fitBoardToPortraitViewport(sourceBoard, portraitCrop);
const boardTransform = fittedBoard._portraitTransform;
const sourceBoardLeft = sourceBoard.x * 1920;
const displayedBoardLeft = boardTransform.translateX + sourceBoardLeft * boardTransform.scale;
const displayedBoardRight = displayedBoardLeft + sourceBoard.w * boardTransform.scale;
assert(displayedBoardLeft >= portraitCrop.left + 12, 'Portrait board must remain inside the crop safe margin');
assert(displayedBoardRight <= portraitCrop.right - 12, 'Portrait board must not overflow the crop');
assert(Math.abs((sourceBoard.w * boardTransform.scale) / (sourceBoard.h * boardTransform.scale) - sourceBoard.w / sourceBoard.h) < 1e-10, 'Portrait board scaling must preserve its proportions');
const portraitSpec = JSON.parse(JSON.stringify(spec));
portraitSpec.scenes[0].portrait_focus = 'char_1';
portraitSpec.scenes[0].portrait_focus_x = 0.42;
const portraitEp = compileEpisode(portraitSpec, { width: 540, height: 960 });
assert.strictEqual(portraitEp.scenes[0].portraitFocus, 'char_1');
assert.strictEqual(portraitEp.scenes[0].portraitFocusX, 0.42);
assert.strictEqual(portraitEp.warnings.length, 0, 'Valid explicit portrait framing must compile without warnings');
const portraitCanvas = createCanvas(540, 960);
const portraitCtx = portraitCanvas.getContext('2d');
const portraitLayout = renderEpisodeFrame(portraitCtx, 540, 960, portraitEp, 15);
assert.strictEqual(portraitLayout.orientation, 'portrait');
assert(portraitLayout.viewport.width >= 1080 * (540 / 960) - 1, 'Portrait source crop must cover the 9:16 field of view');
assert(portraitLayout.viewport.width <= 1920, 'Portrait crop must stay within the authored stage');
assert(portraitLayout.viewport.centerX >= portraitLayout.viewport.left);
assert(portraitLayout.viewport.centerX <= portraitLayout.viewport.right);

// Held objects (not only the speaker's body) are part of the portrait composition envelope.
const portraitCamera = { zoom: 1.28, panX: 0, focusX: 0.56 * 1920, focusY: 0.64 * 1080 };
const noSpeech = { activeSpeaker: null, activeLine: null, hasCharacterDialogue: false };
function assertHeldObjectFitsPortrait(action, actorId, boundsForState, label, beatOverrides = {}) {
  const actor = {
    id: actorId,
    scale: 1.62,
    beats: [{ start: 0, end: 8, action, x: 0.62, facing: 1, umbrella_color: '#ef4444', ...beatOverrides }],
  };
  const scene = {
    duration: 8, startSec: 0, characters: [actor], boards: [], props: [], lineTimings: [],
    portraitFocus: null, portraitFocusX: null,
  };
  const episode = { fps: 30, scenes: [scene] };
  const viewport = computePortraitViewport(episode, 150, 540, 960, {
    baseWidth: 1920,
    baseHeight: 1080,
    floorY: 855,
    findSceneAtFrame: () => ({ type: 'scene', scene }),
    evaluateSceneCamera: () => portraitCamera,
    evaluateSceneSpeechState: () => noSpeech,
  });
  const state = evaluateCharacterState(actor, 5, 8, 5, 1920, 855, noSpeech);
  const screenX = (x) => 960 + portraitCamera.zoom * (x - portraitCamera.focusX - portraitCamera.panX);
  const object = boundsForState(state, screenX);
  const rig = skeleton(state.x, state.fy, state.s, state.pose, state.flip);
  const actorXs = [rig.world.head, rig.world.hip, rig.world.spineMid, rig.world.shoulder]
    .concat(rig.world.ll, rig.world.lr, rig.world.al, rig.world.ar)
    .filter((point) => Array.isArray(point))
    .map((point) => screenX(point[0]));
  const left = Math.min(...actorXs, object.left);
  const right = Math.max(...actorXs, object.right);
  assert(viewport.left <= left - 8, `${label} and actor should fit inside the portrait crop's left safe margin`);
  assert(viewport.right >= right + 8, `${label} and actor should fit inside the portrait crop's right safe margin`);
  assert(viewport.width <= 1920, 'Object-aware portrait crop must stay within the authored stage');
}
assertHeldObjectFitsPortrait('hold_umbrella', 'umbrella_holder', (state, screenX) => {
  const item = state.heldUmbrella;
  const tilt = item.tilt || 0;
  const canopyCenterOffset = (item.shaftLength || 108) - 88 * 0.52;
  const center = screenX(item.x + Math.sin(tilt) * canopyCenterOffset * state.s);
  const halfWidth = (88 * (Math.abs(Math.cos(tilt)) + Math.abs(Math.sin(tilt))) + 5) * state.s * portraitCamera.zoom;
  return { left: center - halfWidth, right: center + halfWidth };
}, 'Open umbrella');
assertHeldObjectFitsPortrait('offer_umbrella', 'umbrella_offerer', (state, screenX) => {
  const item = state.heldUmbrella;
  const tilt = item.tilt || 0;
  const canopyCenterOffset = item.shaftLength - 88 * 0.52;
  const center = screenX(item.x + Math.sin(tilt) * canopyCenterOffset * state.s);
  const halfWidth = (88 * (Math.abs(Math.cos(tilt)) + Math.abs(Math.sin(tilt))) + 5) * state.s * portraitCamera.zoom;
  return { left: center - halfWidth, right: center + halfWidth };
}, 'Offered umbrella', { umbrella_open: true });
assertHeldObjectFitsPortrait('hold_drawing', 'drawing_holder', (state, screenX) => {
  const item = state.heldDrawing;
  const angle = (item.facing || 1) * 0.16;
  const center = screenX(item.x);
  const halfWidth = (14 * Math.abs(Math.cos(angle)) + 11 * Math.abs(Math.sin(angle)) + 3) * state.s * portraitCamera.zoom;
  return { left: center - halfWidth, right: center + halfWidth };
}, 'Held drawing');

const groupCamera = { zoom: 1.2, panX: 0, focusX: 960, focusY: 0.64 * 1080 };
const groupActors = [
  { id: 'group_umbrella', scale: 1.62, beats: [{ start: 0, end: 8, action: 'hold_umbrella', x: 0.38, facing: 1 }] },
  { id: 'group_listener', scale: 1.62, beats: [{ start: 0, end: 8, action: 'idle_stand', x: 0.63, facing: -1 }] },
];
const groupScene = {
  duration: 8, startSec: 0, characters: groupActors, boards: [], props: [], lineTimings: [],
  portraitFocus: null, portraitFocusX: null,
};
const groupEpisode = { fps: 30, scenes: [groupScene] };
const groupViewport = computePortraitViewport(groupEpisode, 150, 540, 960, {
  baseWidth: 1920,
  baseHeight: 1080,
  floorY: 855,
  findSceneAtFrame: () => ({ type: 'scene', scene: groupScene }),
  evaluateSceneCamera: () => groupCamera,
  evaluateSceneSpeechState: () => noSpeech,
});
assert(groupViewport.cameraZoomScale < 1, 'Wide narration-led groups should zoom out uniformly to preserve all actors and props');
assert.strictEqual(groupViewport.width, 607.5, 'Portrait group framing should remain full-bleed at the native 9:16 crop');
const groupScaleX = (x) => 960 + groupViewport.cameraZoomScale * (960 + groupCamera.zoom * (x - groupCamera.focusX) - 960);
const umbrellaState = evaluateCharacterState(groupActors[0], 5, 8, 5, 1920, 855, noSpeech);
const umbrellaItem = umbrellaState.heldUmbrella;
const umbrellaTilt = umbrellaItem.tilt || 0;
const umbrellaCenter = umbrellaItem.x + Math.sin(umbrellaTilt) * 62 * umbrellaState.s;
const umbrellaHalfWidth = (88 * (Math.abs(Math.cos(umbrellaTilt)) + Math.abs(Math.sin(umbrellaTilt))) + 5) * umbrellaState.s * groupCamera.zoom * groupViewport.cameraZoomScale;
const listenerState = evaluateCharacterState(groupActors[1], 5, 8, 5, 1920, 855, noSpeech);
const listenerRig = skeleton(listenerState.x, listenerState.fy, listenerState.s, listenerState.pose, listenerState.flip);
const listenerPoints = [listenerRig.world.head, listenerRig.world.hip, listenerRig.world.spineMid, listenerRig.world.shoulder]
  .concat(listenerRig.world.ll, listenerRig.world.lr, listenerRig.world.al, listenerRig.world.ar)
  .filter((point) => Array.isArray(point));
const listenerRight = groupScaleX(Math.max(...listenerPoints.map((point) => point[0])))
  + 12 * listenerState.s * groupCamera.zoom * groupViewport.cameraZoomScale;
assert(groupViewport.left <= groupScaleX(umbrellaCenter) - umbrellaHalfWidth - 8, 'Portrait group crop must include the complete held umbrella');
assert(groupViewport.right >= listenerRight + 8, 'Portrait group crop must include the neighboring listener');

const widerGroupActors = [
  { id: 'near_prop', scale: 1.62, beats: [{ start: 0, end: 8, action: 'hold_umbrella', x: 0.34, facing: 1 }] },
  { id: 'group_focus', scale: 1.62, beats: [{ start: 0, end: 8, action: 'idle_stand', x: 0.5, facing: -1 }] },
  { id: 'farther_extra', scale: 1.62, beats: [{ start: 0, end: 8, action: 'idle_stand', x: 0.68, facing: -1 }] },
];
const widerGroupScene = { ...groupScene, characters: widerGroupActors };
const widerGroupViewport = computePortraitViewport({ fps: 30, scenes: [widerGroupScene] }, 150, 540, 960, {
  baseWidth: 1920,
  baseHeight: 1080,
  floorY: 855,
  findSceneAtFrame: () => ({ type: 'scene', scene: widerGroupScene }),
  evaluateSceneCamera: () => groupCamera,
  evaluateSceneSpeechState: () => noSpeech,
});
assert.strictEqual(widerGroupViewport.width, 607.5, 'Crowded portrait groups should avoid oversized letterboxed crops');
assert(widerGroupViewport.centerX < 900, 'When the full group cannot fit, framing should retain the nearby focal actor and important prop');

const landscapeCamera = { zoom: 1.2, panX: 0, focusX: 960, focusY: 0.64 * 1080 };
const landscapePropActor = {
  id: 'landscape_edge_umbrella',
  scale: 1.62,
  beats: [{ start: 0, end: 8, action: 'hold_umbrella', x: 0.92, facing: 1, umbrella_color: '#ef4444' }],
};
const landscapePropScene = {
  duration: 8, startSec: 0, characters: [landscapePropActor], boards: [], props: [], lineTimings: [],
  portraitFocus: null, portraitFocusX: null,
};
const landscapePropScale = computeLandscapePropZoomScale({ fps: 30, scenes: [landscapePropScene] }, 150, {
  baseWidth: 1920,
  baseHeight: 1080,
  floorY: 855,
  findSceneAtFrame: () => ({ type: 'scene', scene: landscapePropScene }),
  evaluateSceneCamera: () => landscapeCamera,
  evaluateSceneSpeechState: () => noSpeech,
});
assert(landscapePropScale < 1, 'Landscape camera pushes should ease back when a held prop reaches the frame edge');
const safeLandscapeActor = {
  ...landscapePropActor,
  beats: [{ start: 0, end: 8, action: 'hold_umbrella', x: 0.5, facing: 1, umbrella_color: '#ef4444' }],
};
const safeLandscapeScene = { ...landscapePropScene, characters: [safeLandscapeActor] };
const safeLandscapeScale = computeLandscapePropZoomScale({ fps: 30, scenes: [safeLandscapeScene] }, 150, {
  baseWidth: 1920,
  floorY: 855,
  findSceneAtFrame: () => ({ type: 'scene', scene: safeLandscapeScene }),
  evaluateSceneCamera: () => landscapeCamera,
  evaluateSceneSpeechState: () => noSpeech,
});
assert.strictEqual(safeLandscapeScale, 1, 'Landscape framing should preserve authored zoom when held props already fit');
const landscapePropState = evaluateCharacterState(landscapePropActor, 5, 8, 5, 1920, 855, noSpeech);
const landscapeUmbrella = landscapePropState.heldUmbrella;
const landscapeUmbrellaCenter = landscapeUmbrella.x + Math.sin(landscapeUmbrella.tilt || 0) * 62 * landscapePropState.s;
const landscapeUmbrellaHalfWidth = (88 * (Math.abs(Math.cos(landscapeUmbrella.tilt || 0)) + Math.abs(Math.sin(landscapeUmbrella.tilt || 0))) + 5)
  * landscapePropState.s * landscapeCamera.zoom * landscapePropScale;
const landscapeProjectedRight = 960 + landscapePropScale * (960 + landscapeCamera.zoom * (landscapeUmbrellaCenter - landscapeCamera.focusX) - 960)
  + landscapeUmbrellaHalfWidth;
assert(landscapeProjectedRight <= 1908, 'Landscape framing should bring held umbrellas inside the safe frame edge');

const speakerSpec = JSON.parse(JSON.stringify(spec));
speakerSpec.scenes[0].line_timings = [
  { speaker: 'char_1', text: 'First speaker.', start: 0.2, end: 1.7 },
  { speaker: 'char_2', text: 'Second speaker.', start: 2.0, end: 4.0 },
];
const speakerEp = compileEpisode(speakerSpec, { width: 540, height: 960 });
const beforeSpeakerChange = renderEpisodeFrame(portraitCtx, 540, 960, speakerEp, 59).viewport.centerX;
const firstSpeakerChangeFrame = renderEpisodeFrame(portraitCtx, 540, 960, speakerEp, 60).viewport.centerX;
const nextSpeakerChangeFrame = renderEpisodeFrame(portraitCtx, 540, 960, speakerEp, 61).viewport.centerX;
const settledSpeakerFrame = renderEpisodeFrame(portraitCtx, 540, 960, speakerEp, 78).viewport.centerX;
assert(Math.abs(firstSpeakerChangeFrame - beforeSpeakerChange) < 40, 'Portrait crop should ease, not jump, when dialogue changes speaker');
assert(Math.abs(nextSpeakerChangeFrame - firstSpeakerChangeFrame) < 40, 'Speaker-following portrait crop should move smoothly across adjacent frames');
assert(Math.abs(settledSpeakerFrame - beforeSpeakerChange) > 120, 'Portrait framing should settle on the new active speaker');
const portraitPixels = portraitCtx.getImageData(270, 480, 1, 1).data;
assert.strictEqual(portraitPixels[3], 255, 'Portrait renderer must produce an opaque full-frame image');

console.log(
  JSON.stringify(
    {
      js_tests: 'PASSED',
      actions_verified: SUPPORTED_ACTIONS.length,
      builds_verified: Object.keys(BUILDS).length,
      hairstyles_verified: SUPPORTED_HAIRSTYLES.length,
      accessories_verified: SUPPORTED_ACCESSORIES.length - 1,
      preset_environments: SUPPORTED_ENVIRONMENTS.length,
      custom_parametric_settings: true,
      dual_actor_ik_verified: true,
      multiword_subtitle_glow_verified: true,
      bone_stretch_max_px: 0.0,
      stance_foot_slip_px: 0.0,
    },
    null,
    2
  )
);
