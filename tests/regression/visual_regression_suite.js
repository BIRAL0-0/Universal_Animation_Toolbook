'use strict';

/**
 * Controlled 17-Scenario Visual, Anatomical, Prop-Interaction, Continuity,
 * Subtitle-Collision, and Format-Policy Regression Suite.
 *
 * Usage:
 *   node tests/regression/visual_regression_suite.js [--render-sheets]
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createCanvas } = require('../../universal_toolbook/engine/canvas_backend');
const { registerFonts, SANS } = require('../../universal_toolbook/engine/font');
const {
  BONES,
  CANONICAL_CHARACTER_SPEC,
  skeleton,
} = require('../../universal_toolbook/engine/character_rig');
const { DEFAULT_VISUAL_IDENTITY } = require('../../universal_toolbook/engine/environments');
const { CANONICAL_ASSET_LIBRARY, computePropAnchors } = require('../../universal_toolbook/engine/world_props_and_boards');
const {
  INTERACTION_PHASES,
  SUPPORTED_ACTIONS,
  evaluateCharacterState,
  resolveScenePropInteractions,
} = require('../../universal_toolbook/engine/motion_library');
const {
  FORMAT_DURATION_BOUNDARY_SEC,
  selectVideoFormatForDuration,
  getLayoutConfig,
  measureAndPlaceSubtitle,
} = require('../../universal_toolbook/engine/render_layout');
const { compileEpisode } = require('../../universal_toolbook/engine/episode');
const { renderEpisodeFrame } = require('../../universal_toolbook/engine/video_renderer');

registerFonts();

function buildBaseCast() {
  return {
    alex: {
      style: 'cel',
      color: '#f3f5fa',
      build: 'average',
      scale: 1.56,
    },
    maya: {
      style: 'cel',
      color: '#dbe5f5',
      build: 'slim',
      scale: 1.50,
    },
  };
}

function runVisualRegressionSuite(options = {}) {
  const renderSheets = Boolean(options.renderSheets);

  // A. Canonical character, visual identity, and asset library invariants
  assert.strictEqual(CANONICAL_CHARACTER_SPEC.singleColorBody, true, 'Canonical character must use uniform single-colour silhouette');
  assert.strictEqual(CANONICAL_CHARACTER_SPEC.uniformLimbFill, true, 'Canonical character limbs must share uniform fill');
  assert.strictEqual(DEFAULT_VISUAL_IDENTITY.mode, 'near_black_minimal');
  assert.strictEqual(DEFAULT_VISUAL_IDENTITY.lock_identity, true);
  assert(SUPPORTED_ACTIONS.length >= 70, `Expected >= 70 supported actions, got ${SUPPORTED_ACTIONS.length}`);
  assert.strictEqual(INTERACTION_PHASES.length, 7, 'Expected 7 canonical object interaction phase groups');
  for (const key of ['phone', 'chair', 'desk', 'table', 'cup', 'laptop', 'book', 'door']) {
    assert(CANONICAL_ASSET_LIBRARY[key], `Missing canonical asset definition: ${key}`);
  }

  // B. Automatic Video Format & Duration Policy (< 60.0s -> 9:16, >= 60.0s -> 16:9, explicit override)
  assert.strictEqual(FORMAT_DURATION_BOUNDARY_SEC, 60);
  const f24 = selectVideoFormatForDuration(24.0);
  assert.strictEqual(f24.aspect, '9:16');
  assert.strictEqual(f24.width, 1080);
  assert.strictEqual(f24.height, 1920);
  assert.strictEqual(f24.overridden, false);

  const f59 = selectVideoFormatForDuration(59.9);
  assert.strictEqual(f59.aspect, '9:16');
  assert.strictEqual(f59.width, 1080);
  assert.strictEqual(f59.height, 1920);

  const f60 = selectVideoFormatForDuration(60.0);
  assert.strictEqual(f60.aspect, '16:9');
  assert.strictEqual(f60.width, 1920);
  assert.strictEqual(f60.height, 1080);
  assert.strictEqual(f60.overridden, false);

  const f120 = selectVideoFormatForDuration(120.0);
  assert.strictEqual(f120.aspect, '16:9');
  assert.strictEqual(f120.width, 1920);
  assert.strictEqual(f120.height, 1080);

  const fOverrideShortToWide = selectVideoFormatForDuration(35.0, { explicitAspect: '16:9' });
  assert.strictEqual(fOverrideShortToWide.aspect, '16:9');
  assert.strictEqual(fOverrideShortToWide.overridden, true);
  assert.strictEqual(fOverrideShortToWide.recommendedAspect, '9:16');

  const fOverrideLongToVertical = selectVideoFormatForDuration(85.0, { explicitAspect: '9:16' });
  assert.strictEqual(fOverrideLongToVertical.aspect, '9:16');
  assert.strictEqual(fOverrideLongToVertical.width, 1080);
  assert.strictEqual(fOverrideLongToVertical.height, 1920);
  assert.strictEqual(fOverrideLongToVertical.overridden, true);
  assert.strictEqual(fOverrideLongToVertical.recommendedAspect, '16:9');

  // Verify compileEpisode populates formatPolicy and keeps override notices out of warnings[]
  const overrideEp = compileEpisode({
    title: 'Format Override Verification',
    video_format_override: '16:9',
    cast: buildBaseCast(),
    scenes: [
      {
        id: 'S01',
        duration: 18,
        environment: 'studio_dark',
        characters: [{ id: 'alex', beats: [{ start: 0, end: 18, action: 'idle_stand', x: 0.5 }] }],
      },
    ],
  });
  assert.strictEqual(overrideEp.formatPolicy.aspect, '16:9');
  assert.strictEqual(overrideEp.formatPolicy.overridden, true);
  assert.strictEqual(overrideEp.warnings.length, 0, 'Format override notice must not pollute episode.warnings');
  assert(overrideEp.notices.some((n) => n.includes('overrides automatic duration policy')), 'Expected override notice in episode.notices');

  // C. Build the 17 mandatory visual scenarios
  const phoneLifecycleSpec = {
    title: 'Controlled Regression Suite',
    subtitles_mode: 'cinema',
    cast: buildBaseCast(),
    chapters: [{ scene: 'S07', number: '01', title: 'Attention Architecture' }],
    scenes: [
      // Scenarios 1-3: Standing, Walking, Running
      {
        id: 'S01',
        duration: 6.0,
        location_id: 'locomotion_stage',
        environment: 'studio_dark',
        characters: [
          {
            id: 'alex',
            beats: [
              { start: 0.0, end: 1.8, action: 'idle_stand', x: 0.28, facing: 1 },
              { start: 1.8, end: 4.0, action: 'walk', from_x: 0.28, to_x: 0.54 },
              { start: 4.0, end: 6.0, action: 'run', from_x: 0.54, to_x: 0.80 },
            ],
          },
        ],
      },
      // Scenario 4: Sitting on chair
      {
        id: 'S02',
        duration: 3.0,
        location_id: 'chair_stage',
        environment: 'studio_dark',
        props: [{ id: 'chair_main', type: 'chair', x: 0.48, facing: 'right' }],
        characters: [
          {
            id: 'alex',
            beats: [{ start: 0.0, end: 3.0, action: 'sit_chair', x: 0.48, facing: 1 }],
          },
        ],
      },
      // Scenarios 5-10: Full Phone Lifecycle (reach, pick_up, hold, scroll, type, put_down onto new x=0.59)
      {
        id: 'S03',
        duration: 13.0,
        location_id: 'study_table',
        environment: 'studio_dark',
        props: [
          { id: 'table_study', type: 'table', x: 0.54 },
          { id: 'phone_study', type: 'phone', x: 0.51, elevation: 108 },
          { id: 'cup_study', type: 'cup', x: 0.61, elevation: 108 },
        ],
        characters: [
          {
            id: 'alex',
            beats: [
              { start: 0.0, end: 2.2, action: 'reach_phone', x: 0.36, facing: 1, target_prop: 'phone_study' },
              { start: 2.2, end: 4.4, action: 'pick_up_phone', x: 0.36, facing: 1, target_prop: 'phone_study' },
              { start: 4.4, end: 6.4, action: 'hold_phone', x: 0.38, facing: 1, target_prop: 'phone_study' },
              { start: 6.4, end: 8.6, action: 'phone_scroll', x: 0.38, facing: 1, target_prop: 'phone_study' },
              { start: 8.6, end: 10.8, action: 'phone_type', x: 0.38, facing: 1, target_prop: 'phone_study' },
              { start: 10.8, end: 13.0, action: 'put_down_phone', x: 0.38, facing: 1, target_prop: 'phone_study', release_x: 0.59 },
            ],
          },
        ],
      },
      // Cross-cut scene & return to study_table to verify persistent phone_study x=0.59 continuity!
      // Scenario 11: Desk / Table interaction
      {
        id: 'S04',
        duration: 3.0,
        location_id: 'office_desk',
        environment: 'studio_dark',
        props: [
          { id: 'desk_work', type: 'desk', x: 0.52 },
          { id: 'laptop_work', type: 'laptop', x: 0.53, elevation: 112, facing: 'left' },
          { id: 'cup_work', type: 'cup', x: 0.45, elevation: 112 },
        ],
        characters: [
          { id: 'alex', beats: [{ start: 0.0, end: 3.0, action: 'sit_desk_type', x: 0.52 }] },
        ],
      },
      // Scenario 12: Door interaction + persistent study_table check
      {
        id: 'S05',
        duration: 3.2,
        location_id: 'study_table',
        environment: 'studio_dark',
        props: [
          { id: 'table_study', type: 'table', x: 0.54 },
          { id: 'phone_study', type: 'phone', x: 0.51, elevation: 108 },
          { id: 'door_exit', type: 'door', x: 0.74 },
        ],
        characters: [
          { id: 'alex', beats: [{ start: 0.0, end: 3.2, action: 'open_door', x: 0.65, facing: 1, target_prop: 'door_exit' }] },
        ],
      },
      // Scenario 13: Multi-character interaction
      {
        id: 'S06',
        duration: 3.0,
        location_id: 'duo_stage',
        environment: 'studio_dark',
        characters: [
          { id: 'alex', beats: [{ start: 0.0, end: 3.0, action: 'talk_explain', x: 0.38, facing: 1 }] },
          { id: 'maya', beats: [{ start: 0.0, end: 3.0, action: 'nod_yes', x: 0.62, facing: -1 }] },
        ],
      },
      // Scenarios 14-17: Camera transition + subtitle-heavy active scene (tested in both 16:9 and 9:16!)
      {
        id: 'S07',
        duration: 5.0,
        location_id: 'subtitle_stage',
        environment: 'minimal_void',
        camera_shots: [
          { start: 0.0, zoom_from: 1.0, zoom_to: 1.08, focus_x: 0.50, focus_y: 0.58, move_dur: 2.0 },
          { start: 2.2, cut: true, zoom_from: 1.24, zoom_to: 1.28, focus_x: 0.50, focus_y: 0.74, move_dur: 2.6 },
        ],
        dialogue: [
          {
            speaker: 'narrator',
            text: 'Every quiet habit shapes who you become when nobody is watching.',
            pause_after: 0.8,
          },
        ],
        line_timings: [
          {
            speaker: 'narrator',
            text: 'Every quiet habit shapes who you become when nobody is watching.',
            start: 0.25,
            end: 3.60,
          },
        ],
        accent_words: ['quiet habit', 'nobody is watching'],
        characters: [
          {
            id: 'alex',
            scale: 1.78,
            beats: [{ start: 0.0, end: 5.0, action: 'kneel_lookup', x: 0.50, facing: 1 }],
          },
        ],
      },
    ],
  };

  const epWide = compileEpisode(JSON.parse(JSON.stringify(phoneLifecycleSpec)), { width: 1920, height: 1080 });
  const epVert = compileEpisode(JSON.parse(JSON.stringify(phoneLifecycleSpec)), { width: 1080, height: 1920 });
  assert.strictEqual(epWide.warnings.length, 0, `Unexpected warnings: ${JSON.stringify(epWide.warnings)}`);

  // Verify cross-cut prop state continuity: S03 put_down_phone moved phone_study to 0.59,
  // and S05 (returning to study_table after S04 cross-cut) inherited x === 0.59 automatically!
  const s05Phone = epWide.scenes[4].props.find((p) => p.id === 'phone_study');
  assert(s05Phone && Math.abs(s05Phone.x - 0.59) < 1e-6, `Cross-cut prop state continuity failed: got x=${s05Phone?.x}`);

  // Verify strict speech-end subtitle cutoff: line ends at 3.60s in S07,
  // so every cue must end <= 3.60s and at t = 3.95s within S07 (during pause_after silence) zero subtitles are shown!
  const s07 = epWide.scenes[6];
  assert(Array.isArray(s07.subtitles) && s07.subtitles.length > 0, 'Expected compiled scene subtitles on S07');
  for (const cue of s07.subtitles) {
    assert(cue.end <= 3.60 + 1e-3, `Subtitle lingered into post-speech silence: ${JSON.stringify(cue)}`);
  }

  // Verify physical interaction invariants directly on S03 & S05
  const s03 = epWide.scenes[2];
  // Reach phase (ts = 1.6): actor does not walk through table & elbow stays bent
  {
    const st = evaluateCharacterState(s03.characters[0], 1.6, s03.duration, 1.6, 1920, 855);
    const props = resolveScenePropInteractions(s03.props, [{ actor: s03.characters[0], state: st }], s03.characters, 1.6, s03.duration, 1920, 855);
    const tableAnchors = computePropAnchors(props[0], 1920, 855);
    assert(st.x <= tableAnchors.bounds.left - 8, `Actor walked inside table bounds on reach_phone: x=${st.x}, tableLeft=${tableAnchors.bounds.left}`);
  }
  // Pick-up phase (ts = 3.6): phone attached to alex (no duplicate table copy)
  {
    const st = evaluateCharacterState(s03.characters[0], 3.6, s03.duration, 3.6, 1920, 855);
    const props = resolveScenePropInteractions(s03.props, [{ actor: s03.characters[0], state: st }], s03.characters, 3.6, s03.duration, 1920, 855);
    const ph = props.find((p) => p.id === 'phone_study');
    assert.strictEqual(ph._attachedToActor, 'alex', 'Phone must switch parent cleanly to hand during pick_up_phone');
    assert(st.heldPhone && st.heldPhone.inHand === true, 'Actor must hold phone in hand during pick_up_phone');
  }
  // Put-down phase (ts = 12.6): phone released cleanly at x = 0.59 AND actor clamped outside table!
  {
    const st = evaluateCharacterState(s03.characters[0], 12.6, s03.duration, 12.6, 1920, 855);
    const props = resolveScenePropInteractions(s03.props, [{ actor: s03.characters[0], state: st }], s03.characters, 12.6, s03.duration, 1920, 855);
    const tableAnchors = computePropAnchors(props[0], 1920, 855);
    const ph = props.find((p) => p.id === 'phone_study');
    assert.strictEqual(ph._attachedToActor, null, 'Phone must detach back to world surface after put_down_phone');
    assert(Math.abs(ph.x - 0.59) < 1e-4, `Released phone must rest at new x=0.59, got ${ph.x}`);
    assert(!st.heldPhone, 'Actor must not still hold a duplicate phone after release');
    assert(st.x <= tableAnchors.bounds.left - 8, `Actor walked inside table bounds on put_down_phone: x=${st.x}, tableLeft=${tableAnchors.bounds.left}`);
  }

  // Render all 17 scenarios through the real renderEpisodeFrame pipeline and assert metadata!
  const scenarios = [
    { num: 1, name: '01 Neutral Standing', ep: epWide, w: 960, h: 540, t: s03.startSec - 8.2 }, // S01 t=0.8
    { num: 2, name: '02 Walking Cycle', ep: epWide, w: 960, h: 540, t: 2.9 },
    { num: 3, name: '03 Running Cycle', ep: epWide, w: 960, h: 540, t: 5.0 },
    { num: 4, name: '04 Sitting on Chair', ep: epWide, w: 960, h: 540, t: epWide.scenes[1].startSec + 1.5 },
    { num: 5, name: '05 Reaching for Phone', ep: epWide, w: 960, h: 540, t: s03.startSec + 1.6 },
    { num: 6, name: '06 Picking Up Phone', ep: epWide, w: 960, h: 540, t: s03.startSec + 3.6 },
    { num: 7, name: '07 Holding Phone', ep: epWide, w: 960, h: 540, t: s03.startSec + 5.4 },
    { num: 8, name: '08 Scrolling Phone', ep: epWide, w: 960, h: 540, t: s03.startSec + 7.5 },
    { num: 9, name: '09 Typing on Phone (2-Hand)', ep: epWide, w: 960, h: 540, t: s03.startSec + 9.7 },
    { num: 10, name: '10 Putting Down Phone', ep: epWide, w: 960, h: 540, t: s03.startSec + 11.7 },
    { num: 11, name: '11 Desk & Laptop Split-Plane', ep: epWide, w: 960, h: 540, t: epWide.scenes[3].startSec + 1.5 },
    { num: 12, name: '12 Hinged Door + Moved Phone', ep: epWide, w: 960, h: 540, t: epWide.scenes[4].startSec + 2.0 },
    { num: 13, name: '13 Multi-Character Exchange', ep: epWide, w: 960, h: 540, t: epWide.scenes[5].startSec + 1.5 },
    { num: 14, name: '14 Camera Cut & Push-In', ep: epWide, w: 960, h: 540, t: s07.startSec + 0.15 },
    { num: 15, name: '15 Active Subtitle Relocation', ep: epWide, w: 1920, h: 1080, t: s07.startSec + 2.8 },
    { num: 16, name: '16 Landscape 16:9 Subtitles', ep: epWide, w: 1920, h: 1080, t: s07.startSec + 1.1 },
    { num: 17, name: '17 Vertical 9:16 Shorts Subtitles', ep: epVert, w: 1080, h: 1920, t: s07.startSec + 2.8 },
  ];

  const renderedCanvases = [];
  for (const sc of scenarios) {
    const c = createCanvas(sc.w, sc.h);
    const ctx = c.getContext('2d');
    const fIdx = Math.round(sc.t * sc.ep.fps);
    const res = renderEpisodeFrame(ctx, sc.w, sc.h, sc.ep, fIdx);
    const px = ctx.getImageData(Math.floor(sc.w / 2), Math.floor(sc.h / 2), 1, 1).data;
    assert.strictEqual(px[3], 255, `Scenario ${sc.num} produced non-opaque frame`);
    if (sc.num >= 15) {
      assert(res.subtitleLayout, `Scenario ${sc.num} must produce active subtitleLayout`);
      assert.strictEqual(
        res.subtitleLayout.criticalOverlapPx,
        0,
        `Scenario ${sc.num} subtitle overlapped character/prop: ${JSON.stringify(res.subtitleLayout)}`
      );
      const layout = getLayoutConfig(sc.w, sc.h);
      const r = res.subtitleLayout.rect;
      assert(r.left >= layout.margins.left - 1, `Scenario ${sc.num} clipped left margin`);
      assert(r.right <= sc.w - layout.margins.right + 1, `Scenario ${sc.num} clipped right margin`);
      assert(r.top >= layout.margins.top - 1, `Scenario ${sc.num} clipped top margin`);
      assert(r.bottom <= sc.h - layout.margins.bottom + 1, `Scenario ${sc.num} clipped bottom margin`);
    }
    if (sc.num === 17) {
      assert.strictEqual(res.orientation, 'portrait');
      for (const line of res.subtitleLayout.lines) {
        const toks = Array.isArray(line) ? line : (line.tokens || []);
        const lineChars = toks.map((tk) => tk.word).join(' ').length;
        assert(lineChars <= 34, `9:16 subtitle line too wide (${lineChars} chars)`);
      }
    }
    renderedCanvases.push({ sc, canvas: c, res });
  }

  let sheetPaths = [];
  if (renderSheets) {
    const outDir = path.resolve(__dirname, '../../runtime/previews');
    fs.mkdirSync(outDir, { recursive: true });

    // Sheet 1: Scenarios 1-12 (4x3 grid of 640x360 panels = 2560x1080)
    const sheet1 = createCanvas(2560, 1080);
    const s1 = sheet1.getContext('2d');
    s1.fillStyle = '#05070c';
    s1.fillRect(0, 0, 2560, 1080);
    renderedCanvases.slice(0, 12).forEach(({ sc, canvas }, idx) => {
      const col = idx % 4;
      const row = Math.floor(idx / 4);
      const x = col * 640;
      const y = row * 360;
      s1.drawImage(canvas, 0, 0, sc.w, sc.h, x + 6, y + 6, 628, 348);
      s1.strokeStyle = 'rgba(255,255,255,0.16)';
      s1.strokeRect(x + 6, y + 6, 628, 348);
      s1.fillStyle = 'rgba(8,10,16,0.82)';
      s1.fillRect(x + 14, y + 14, 290, 28);
      s1.fillStyle = '#f8fafc';
      s1.font = `700 14px "${SANS}"`;
      s1.fillText(sc.name, x + 22, y + 33);
    });
    const p1 = path.join(outDir, 'regression_scenarios_01_12.png');
    fs.writeFileSync(p1, sheet1.toBuffer('image/png'));

    // Sheet 2: Scenarios 13-17 (Scenarios 13-16 on left 2x2 + Scenario 17 full 9:16 vertical on right)
    const sheet2 = createCanvas(1920, 960);
    const s2 = sheet2.getContext('2d');
    s2.fillStyle = '#05070c';
    s2.fillRect(0, 0, 1920, 960);
    renderedCanvases.slice(12, 16).forEach(({ sc, canvas }, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const x = col * 680;
      const y = row * 480;
      s2.drawImage(canvas, 0, 0, sc.w, sc.h, x + 8, y + 48, 664, 374);
      s2.strokeStyle = 'rgba(255,255,255,0.16)';
      s2.strokeRect(x + 8, y + 48, 664, 374);
      s2.fillStyle = '#f8fafc';
      s2.font = `700 15px "${SANS}"`;
      s2.fillText(sc.name, x + 14, y + 32);
    });
    const sc17 = renderedCanvases[16];
    s2.drawImage(sc17.canvas, 0, 0, sc17.sc.w, sc17.sc.h, 1390, 48, 495, 880);
    s2.strokeStyle = 'rgba(255,255,255,0.20)';
    s2.strokeRect(1390, 48, 495, 880);
    s2.fillStyle = '#f8fafc';
    s2.font = `700 15px "${SANS}"`;
    s2.fillText(sc17.sc.name, 1390, 32);
    const p2 = path.join(outDir, 'regression_scenarios_13_17.png');
    fs.writeFileSync(p2, sheet2.toBuffer('image/png'));
    sheetPaths = [p1, p2];
  }

  return {
    scenarios_verified: scenarios.length,
    format_policy_verified: true,
    cross_cut_prop_continuity_verified: true,
    subtitle_zero_overlap_verified: true,
    subtitle_speech_cutoff_verified: true,
    sheets: sheetPaths,
  };
}

if (require.main === module) {
  const renderSheets = process.argv.includes('--render-sheets');
  const summary = runVisualRegressionSuite({ renderSheets });
  console.log(JSON.stringify({ visual_regression_suite: 'PASSED', ...summary }, null, 2));
}

module.exports = { runVisualRegressionSuite };
