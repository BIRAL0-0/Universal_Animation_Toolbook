'use strict';

/**
 * Subject-aware portrait crops for adapting the 16:9 stage to 9:16 outputs.
 * Automatic framing follows the scene's focus character / active speaker; explicit per-scene
 * focus fields remain available when the script needs a particular subject or composition.
 */

const { evaluateCharacterState, resolveSceneInteractions } = require('./motion_library');

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

function speakerTransitionFocusX(scene, speechState, ts, selected, projectedActors) {
  const activeLine = speechState.activeLine;
  const speaker = String(speechState.activeSpeaker || '').toLowerCase();
  if (!activeLine || !speaker || speaker === 'narrator' || !Number.isFinite(Number(activeLine.start))) {
    return selected.screenX;
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
  if (!previousActor || previousActor === selected) return selected.screenX;

  // Ease dialogue-led reframes rather than jumping the crop on every speaker turn.
  const transitionDuration = 0.58;
  const u = Math.max(0, Math.min(1, (ts - Number(activeLine.start)) / transitionDuration));
  const eased = u * u * (3 - 2 * u);
  return previousActor.screenX + (selected.screenX - previousActor.screenX) * eased;
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
    return { left, width: nominalWidth, centerX: baseWidth * 0.5, right: left + nominalWidth };
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
  const projectedActors = entries.map((entry) => ({
    ...entry,
    screenX: screenWorldX(entry.state.x, camera, baseWidth),
  }));
  let focusX = baseWidth * 0.5;
  let subjectRadius = 0;

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
        : selected.screenX;
      subjectRadius = 112 * (selected.state.s || 1) * camera.zoom;
    } else if (sceneBoards.length > 0) {
      focusX = boardPortraitBounds(sceneBoards[0], baseWidth)?.centerX ?? focusX;
    } else {
      const focusProp = (scene.props || []).find((prop) => prop && prop.portrait_focus === true);
      if (focusProp) focusX = screenWorldX(normalizedStageX(focusProp.x ?? 0.5, baseWidth), camera, baseWidth);
    }
  }

  // A single oversized subject may need a little extra width. Ordinary 9:16 crops stay full-bleed.
  const safety = 42;
  const width = Math.min(baseWidth, Math.max(nominalWidth, 2 * (subjectRadius + safety)));
  const left = Math.max(0, Math.min(baseWidth - width, focusX - width * 0.5));
  return { left, width, centerX: left + width * 0.5, right: left + width };
}

module.exports = {
  computePortraitViewport,
  boardPortraitBounds,
  fitBoardToPortraitViewport,
};
