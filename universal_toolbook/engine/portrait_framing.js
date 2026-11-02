'use strict';

/**
 * Subject-aware portrait crops for adapting the 16:9 stage to 9:16 outputs.
 * Automatic framing follows the scene's focus character / active speaker; explicit per-scene
 * focus fields remain available when the script needs a particular subject or composition.
 */

const { evaluateCharacterState, resolveSceneInteractions } = require('./motion_library');
const { BONES, skeleton } = require('./character_rig');

function finiteNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizedStageX(value, baseWidth, fallback = 0.5) {
  return finiteNumber(value, fallback) * baseWidth;
}

function screenWorldX(worldX, camera, baseWidth) {
  return baseWidth * 0.5 + camera.zoom * (worldX - camera.focusX - camera.panX);
}

/** Include a character's important held item in the crop, not just their body center. */
function actorCompositionBounds(entry, camera, baseWidth) {
  const state = entry.state;
  const scale = Math.max(0.1, finiteNumber(state.s, 1));
  const zoom = Math.max(0.05, finiteNumber(camera.zoom, 1));
  let left = entry.screenX;
  let right = entry.screenX;

  const includeWorldPoint = (point, radius) => {
    if (!Array.isArray(point) || !Number.isFinite(Number(point[0]))) return;
    const center = screenWorldX(Number(point[0]), camera, baseWidth);
    const halfWidth = Math.max(0, Number(radius) || 0) * zoom;
    left = Math.min(left, center - halfWidth);
    right = Math.max(right, center + halfWidth);
  };
  const rig = skeleton(state.x, state.fy, scale, state.pose, state.flip);
  const world = rig.world || {};
  includeWorldPoint(world.head, (BONES.HEAD_R + 16) * scale);
  includeWorldPoint(world.hip, 30 * scale);
  includeWorldPoint(world.spineMid, 30 * scale);
  includeWorldPoint(world.shoulder, 32 * scale);
  for (const chain of [world.ll, world.lr, world.al, world.ar]) {
    if (Array.isArray(chain)) chain.forEach((point) => includeWorldPoint(point, 12 * scale));
  }

  const includeWorldX = (worldX, halfWidth) => {
    if (!Number.isFinite(Number(worldX)) || !Number.isFinite(Number(halfWidth))) return;
    const center = screenWorldX(Number(worldX), camera, baseWidth);
    const radius = Math.max(0, Number(halfWidth)) * zoom;
    left = Math.min(left, center - radius);
    right = Math.max(right, center + radius);
  };

  const umbrella = state.heldUmbrella;
  if (umbrella && Number.isFinite(Number(umbrella.x))) {
    const tilt = finiteNumber(umbrella.tilt, 0);
    const cos = Math.abs(Math.cos(tilt));
    const sin = Math.abs(Math.sin(tilt));
    if (umbrella.open) {
      // Open canopy is about 176×176 authoring pixels, with its center above the grip by the shaft offset.
      const canopyCenterOffset = finiteNumber(umbrella.shaftLength, 108) - 88 * 0.52;
      const centerX = Number(umbrella.x) + Math.sin(tilt) * canopyCenterOffset * scale;
      const halfWidth = (88 * (cos + sin) + 5) * scale;
      includeWorldX(centerX, halfWidth);
    } else {
      // Folded canopy and shaft: local bounds are roughly 16×100px around the grip.
      const centerX = Number(umbrella.x) - Math.sin(tilt) * 44 * scale;
      const halfWidth = (8 * cos + 50 * sin + 4) * scale;
      includeWorldX(centerX, halfWidth);
    }
  }

  const blueprint = state.heldBlueprint;
  if (blueprint && Number.isFinite(Number(blueprint.x))) {
    const angle = finiteNumber(blueprint.facing, 1) * 0.18;
    const halfWidth = (22 * Math.abs(Math.cos(angle)) + 15 * Math.abs(Math.sin(angle)) + 3) * scale;
    includeWorldX(blueprint.x, halfWidth);
  }

  const drawing = state.heldDrawing;
  if (drawing && Number.isFinite(Number(drawing.x))) {
    const angle = finiteNumber(drawing.facing, 1) * 0.16;
    const halfWidth = (14 * Math.abs(Math.cos(angle)) + 11 * Math.abs(Math.sin(angle)) + 3) * scale;
    includeWorldX(drawing.x, halfWidth);
  }

  const phone = state.heldPhone;
  if (phone && Number.isFinite(Number(phone.x))) {
    const angle = finiteNumber(phone.facing, 1) * -0.45;
    const halfWidth = (7 * Math.abs(Math.cos(angle)) + 13 * Math.abs(Math.sin(angle)) + 3) * scale;
    includeWorldX(phone.x, halfWidth);
  }

  const cup = state.heldCup;
  if (cup && Number.isFinite(Number(cup.x))) {
    const angle = finiteNumber(cup.tilt, 0);
    const halfWidth = (8 * Math.abs(Math.cos(angle)) + 10 * Math.abs(Math.sin(angle)) + 3) * scale;
    includeWorldX(cup.x, halfWidth);
  }

  const pen = state.heldPen;
  if (pen && Number.isFinite(Number(pen.x))) {
    includeWorldX(Number(pen.x) + finiteNumber(pen.dir, 1) * 9 * scale, 3 * scale);
  }

  const boulder = state.pushedBoulder;
  if (boulder && Number.isFinite(Number(boulder.x))) {
    includeWorldX(Number(boulder.x) * baseWidth, 68 * finiteNumber(boulder.scale, scale));
  }

  if (state.callout) {
    const calloutHalfWidth = Math.min(260, String(state.callout).length * 9 + 20);
    left = Math.min(left, entry.screenX - calloutHalfWidth * zoom);
    right = Math.max(right, entry.screenX + calloutHalfWidth * zoom);
  }

  if (entry.actor.showNameTag && entry.actor.name) {
    const nameHalfWidth = Math.min(180, String(entry.actor.name).length * 6 + 14);
    left = Math.min(left, entry.screenX - nameHalfWidth * zoom);
    right = Math.max(right, entry.screenX + nameHalfWidth * zoom);
  }

  return { left, right, centerX: (left + right) * 0.5, width: right - left };
}

function speakerTransitionFocusX(scene, speechState, ts, selected, projectedActors) {
  const selectedFocus = selected.composition ? selected.composition.centerX : selected.screenX;
  const activeLine = speechState.activeLine;
  const speaker = String(speechState.activeSpeaker || '').toLowerCase();
  if (!activeLine || !speaker || speaker === 'narrator' || !Number.isFinite(Number(activeLine.start))) {
    return selectedFocus;
  }

  const previousLine = (scene.lineTimings || []).reduce((best, line) => {
    const lineStart = Number(line && line.start);
    const lineSpeaker = String((line && line.speaker) || '').toLowerCase();
    if (!Number.isFinite(lineStart) || lineStart >= Number(activeLine.start) || !lineSpeaker || lineSpeaker === 'narrator') {
      return best;
    }
    return !best || lineStart > Number(best.start) ? line : best;
  }, null);
  const previousSpeaker = String((previousLine && previousLine.speaker) || '').toLowerCase();
  const previousActor = previousSpeaker
    ? projectedActors.find((entry) => String(entry.actor.id || '').toLowerCase() === previousSpeaker)
    : null;
  if (!previousActor || previousActor === selected) return selectedFocus;

  // Ease dialogue-led reframes rather than jumping the crop on every speaker turn.
  const transitionDuration = 0.58;
  const u = Math.max(0, Math.min(1, (ts - Number(activeLine.start)) / transitionDuration));
  const eased = u * u * (3 - 2 * u);
  const previousFocus = previousActor.composition ? previousActor.composition.centerX : previousActor.screenX;
  return previousFocus + (selectedFocus - previousFocus) * eased;
}

function boardPortraitBounds(board, baseWidth, baseHeight = 1080, floorY = 855) {
  if (!board || !board.type) return null;
  const rawW = board.w !== undefined
    ? (Number(board.w) <= 1.5 ? Number(board.w) * baseWidth : Number(board.w))
    : 760;
  const rawH = board.h !== undefined
    ? (Number(board.h) <= 1.5 ? Number(board.h) * baseHeight : Number(board.h))
    : 410;
  const rawX = board.x !== undefined
    ? (Number(board.x) <= 1.5 ? Number(board.x) * baseWidth : Number(board.x))
    : 0.54 * baseWidth;
  const rawY = board.y !== undefined
    ? (Number(board.y) <= 1.5 ? Number(board.y) * baseHeight : Number(board.y))
    : 120;
  const width = Math.min(Math.max(240, finiteNumber(rawW, 760)), baseWidth - 96);
  const height = Math.min(Math.max(160, finiteNumber(rawH, 410)), floorY - 125);
  const left = Math.max(48, Math.min(baseWidth - width - 48, finiteNumber(rawX, 0.54 * baseWidth)));
  const top = Math.max(74, Math.min(floorY - height - 34, finiteNumber(rawY, 120)));
  return { left, right: left + width, top, bottom: top + height, centerX: left + width * 0.5, width, height };
}

function fitBoardToPortraitViewport(board, viewport, baseWidth = 1920, baseHeight = 1080) {
  if (!board || viewport.width >= baseWidth) return board;
  const original = boardPortraitBounds(board, baseWidth, baseHeight);
  if (!original) return board;
  const maxWidth = Math.max(240, viewport.width - 48);
  const requestedWidth = board.portrait_w !== undefined
    ? (Number(board.portrait_w) <= 1.5 ? Number(board.portrait_w) * baseWidth : Number(board.portrait_w))
    : original.width;
  const displayWidth = Math.max(240, Math.min(maxWidth, finiteNumber(requestedWidth, original.width)));
  const scale = displayWidth / original.width;
  const displayedWidth = original.width * scale;
  const requestedX = board.portrait_x !== undefined
    ? (Number(board.portrait_x) <= 1.5 ? Number(board.portrait_x) * baseWidth : Number(board.portrait_x))
    : viewport.centerX;
  const centerX = Math.max(
    viewport.left + displayedWidth * 0.5 + 12,
    Math.min(viewport.right - displayedWidth * 0.5 - 12, finiteNumber(requestedX, viewport.centerX))
  );
  // Scale the complete board (including its typography) uniformly. drawWorldBoard retains the
  // original x/w/h geometry; this transform only repositions and uniformly scales the finished UI.
  return {
    ...board,
    _portraitTransform: {
      scale,
      translateX: centerX - original.centerX * scale,
      translateY: original.top * (1 - scale),
    },
  };
}

/** Compute a portrait viewport in source-stage coordinates without changing image geometry. */
function computePortraitViewport(episode, frameIdx, outW, outH, {
  baseWidth = 1920,
  baseHeight = 1080,
  floorY = 855,
  findSceneAtFrame,
  evaluateSceneCamera,
  evaluateSceneSpeechState,
} = {}) {
  const nominalWidth = Math.max(240, Math.min(baseWidth, (baseHeight * outW) / outH));
  const hit = findSceneAtFrame(episode, frameIdx);
  if (hit.type === 'outro') {
    const left = (baseWidth - nominalWidth) * 0.5;
    return { left, width: nominalWidth, centerX: baseWidth * 0.5, right: left + nominalWidth, cameraZoomScale: 1 };
  }

  const scene = hit.scene;
  const globalT = frameIdx / episode.fps;
  const ts = Math.max(0, Math.min(scene.duration, globalT - scene.startSec));
  const camera = evaluateSceneCamera(scene, ts);
  const speechState = evaluateSceneSpeechState(scene, ts);
  const entries = [];
  for (const actor of (scene.characters || [])) {
    if (actor.from_t !== undefined && ts < actor.from_t) continue;
    if (actor.to_t !== undefined && ts > actor.to_t) continue;
    entries.push({
      actor,
      state: evaluateCharacterState(actor, ts, scene.duration, globalT, baseWidth, floorY, speechState),
    });
  }
  resolveSceneInteractions(entries, globalT, speechState);

  const sceneBoards = Array.isArray(scene.boards) && scene.boards.length > 0
    ? scene.boards
    : (scene.board ? [scene.board] : []);
  const projectedActors = entries.map((entry) => {
    const projected = {
      ...entry,
      screenX: screenWorldX(entry.state.x, camera, baseWidth),
    };
    projected.composition = actorCompositionBounds(projected, camera, baseWidth);
    return projected;
  });
  let focusX = baseWidth * 0.5;
  let subjectWidth = 0;
  const safety = 12;
  const fitWidth = Math.max(1, nominalWidth - safety * 2);

  if (scene.portraitFocusX !== null && scene.portraitFocusX !== undefined) {
    focusX = screenWorldX(normalizedStageX(scene.portraitFocusX, baseWidth), camera, baseWidth);
  } else if (scene.portraitFocus === 'board' && sceneBoards.length > 0) {
    focusX = boardPortraitBounds(sceneBoards[0], baseWidth)?.centerX ?? focusX;
  } else {
    let selected = null;
    if (scene.portraitFocus) {
      selected = projectedActors.find((entry) => String(entry.actor.id) === String(scene.portraitFocus)) || null;
    }
    if (!selected) {
      selected = projectedActors.find((entry) => entry.actor.portrait_focus === true) || null;
    }
    let autoSpeakerFocus = false;
    if (!selected) {
      let speakerId = speechState.activeSpeaker && speechState.activeSpeaker !== 'narrator'
        ? speechState.activeSpeaker
        : null;
      if (!speakerId) {
        const lastCharacterLine = (scene.lineTimings || []).reduce((best, line) => {
          const lineStart = Number(line && line.start);
          const lineSpeaker = String((line && line.speaker) || '').toLowerCase();
          if (!Number.isFinite(lineStart) || lineStart > ts || !lineSpeaker || lineSpeaker === 'narrator') return best;
          return !best || lineStart > Number(best.start) ? line : best;
        }, null);
        speakerId = String((lastCharacterLine && lastCharacterLine.speaker) || '').toLowerCase() || null;
      }
      if (speakerId) {
        selected = projectedActors.find(
          (entry) => String(entry.actor.id || '').toLowerCase() === speakerId
        ) || null;
        autoSpeakerFocus = Boolean(selected && speakerId === String(speechState.activeSpeaker || '').toLowerCase());
      }
    }
    if (!selected && projectedActors.length > 0) {
      // Camera focus is the stable fallback: choose the character closest to the authored focal point.
      selected = projectedActors.reduce((best, entry) => (
        !best || Math.abs(entry.screenX - baseWidth * 0.5) < Math.abs(best.screenX - baseWidth * 0.5)
          ? entry
          : best
      ), null);
    }
    if (selected) {
      focusX = autoSpeakerFocus
        ? speakerTransitionFocusX(scene, speechState, ts, selected, projectedActors)
        : selected.composition.centerX;
      subjectWidth = selected.composition.width;

      // In narration-led group shots, keep nearby characters and their props together when possible.
      // Explicit per-scene focus and active dialogue speakers remain authoritative.
      const activeSpeaker = String(speechState.activeSpeaker || '').toLowerCase();
      const hasExplicitFocus = Boolean(
        scene.portraitFocus ||
        (scene.portraitFocusX !== null && scene.portraitFocusX !== undefined) ||
        selected.actor.portrait_focus === true
      );
      if (!hasExplicitFocus && (!activeSpeaker || activeSpeaker === 'narrator') && projectedActors.length > 1) {
        const nearbyActors = projectedActors
          .filter((entry) => entry !== selected && entry.composition.right > 0 && entry.composition.left < baseWidth)
          .filter((entry) => Math.abs(entry.composition.centerX - selected.composition.centerX) <= nominalWidth * 0.82)
          .sort((a, b) => Math.abs(a.composition.centerX - selected.composition.centerX) - Math.abs(b.composition.centerX - selected.composition.centerX))
          .slice(0, 2);
        if (nearbyActors.length > 0) {
          const group = [selected, ...nearbyActors];
          const maximumFullBleedGroupWidth = fitWidth / 0.68;
          const measureGroup = () => ({
            left: Math.min(...group.map((entry) => entry.composition.left)),
            right: Math.max(...group.map((entry) => entry.composition.right)),
          });
          let bounds = measureGroup();
          while (group.length > 1 && bounds.right - bounds.left > maximumFullBleedGroupWidth) {
            let furthestIndex = 1;
            for (let i = 2; i < group.length; i++) {
              if (Math.abs(group[i].composition.centerX - selected.composition.centerX) >
                  Math.abs(group[furthestIndex].composition.centerX - selected.composition.centerX)) {
                furthestIndex = i;
              }
            }
            group.splice(furthestIndex, 1);
            bounds = measureGroup();
          }
          if (group.length > 1) {
            focusX = (bounds.left + bounds.right) * 0.5;
            subjectWidth = bounds.right - bounds.left;
          }
        }
      }
    } else if (sceneBoards.length > 0) {
      focusX = boardPortraitBounds(sceneBoards[0], baseWidth)?.centerX ?? focusX;
    } else {
      const focusProp = (scene.props || []).find((prop) => prop && prop.portrait_focus === true);
      if (focusProp) focusX = screenWorldX(normalizedStageX(focusProp.x ?? 0.5, baseWidth), camera, baseWidth);
    }
  }

  // If a subject/group is wider than the native 9:16 crop, zoom the authored scene out uniformly
  // around its canvas center. This keeps Shorts full-bleed without stretching or hiding held props.
  const cameraZoomScale = subjectWidth > fitWidth
    ? Math.max(0.68, fitWidth / subjectWidth)
    : 1;
  const scaledFocusX = baseWidth * 0.5 + (focusX - baseWidth * 0.5) * cameraZoomScale;
  const scaledSubjectWidth = subjectWidth * cameraZoomScale;
  const width = Math.min(baseWidth, Math.max(nominalWidth, scaledSubjectWidth + safety * 2));
  const left = Math.max(0, Math.min(baseWidth - width, scaledFocusX - width * 0.5));
  return { left, width, centerX: left + width * 0.5, right: left + width, cameraZoomScale };
}

/** Keep held-object compositions within the landscape stage when an authored camera push would clip them. */
function computeLandscapePropZoomScale(episode, frameIdx, {
  baseWidth = 1920,
  floorY = 855,
  safeMargin = 12,
  minCameraScale = 0.68,
  findSceneAtFrame,
  evaluateSceneCamera,
  evaluateSceneSpeechState,
} = {}) {
  const hit = findSceneAtFrame(episode, frameIdx);
  if (hit.type === 'outro') return 1;
  const scene = hit.scene;
  const globalT = frameIdx / episode.fps;
  const ts = Math.max(0, Math.min(scene.duration, globalT - scene.startSec));
  const camera = evaluateSceneCamera(scene, ts);
  const speechState = evaluateSceneSpeechState(scene, ts);
  const entries = [];
  const importantHeldItems = ['heldUmbrella', 'heldBlueprint', 'heldDrawing', 'heldPhone', 'heldCup', 'heldPen', 'pushedBoulder'];

  for (const actor of (scene.characters || [])) {
    if (actor.from_t !== undefined && ts < actor.from_t) continue;
    if (actor.to_t !== undefined && ts > actor.to_t) continue;
    const state = evaluateCharacterState(actor, ts, scene.duration, globalT, baseWidth, floorY, speechState);
    entries.push({ actor, state, screenX: screenWorldX(state.x, camera, baseWidth) });
  }
  resolveSceneInteractions(entries, globalT, speechState);
  for (const entry of entries) entry.screenX = screenWorldX(entry.state.x, camera, baseWidth);

  const canvasCenterX = baseWidth * 0.5;
  const maximumRadius = canvasCenterX - Math.max(0, safeMargin);
  let cameraScale = 1;
  for (const entry of entries) {
    if (!importantHeldItems.some((key) => entry.state[key])) continue;
    const bounds = actorCompositionBounds(entry, camera, baseWidth);
    if (bounds.right <= 0 || bounds.left >= baseWidth) continue;
    if (bounds.left < safeMargin && canvasCenterX > bounds.left) {
      cameraScale = Math.min(cameraScale, maximumRadius / (canvasCenterX - bounds.left));
    }
    if (bounds.right > baseWidth - safeMargin && bounds.right > canvasCenterX) {
      cameraScale = Math.min(cameraScale, maximumRadius / (bounds.right - canvasCenterX));
    }
  }
  return Math.max(minCameraScale, Math.min(1, cameraScale));
}

module.exports = {
  computePortraitViewport,
  computeLandscapePropZoomScale,
  boardPortraitBounds,
  fitBoardToPortraitViewport,
};
