'use strict';

const fs = require('fs');
const path = require('path');
const { PALETTES } = require('./character_rig');
const { ENVIRONMENTS } = require('./environments');
const {
  SUPPORTED_ACTIONS,
  extractCharacterFootsteps,
  evaluateCharacterState,
  resolveScenePropInteractions,
} = require('./motion_library');
const { SUPPORTED_PROPS, SUPPORTED_BOARDS, CANONICAL_ASSET_LIBRARY } = require('./world_props_and_boards');
const { selectVideoFormatForDuration } = require('./render_layout');

const DEFAULT_CONFIG_PATH = path.join(__dirname, '..', 'config', 'studio_config.json');

function loadStudioConfig(customPath) {
  const p = customPath || DEFAULT_CONFIG_PATH;
  if (fs.existsSync(p)) {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  }
  return {
    channel_name: '',
    fps: 30,
    width: 1920,
    height: 1080,
    film_grain: false,
    subtitles_default: 'cinema',
    bgm_default: 'auto',
  };
}

function normWord(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/^[^a-z0-9%+-]+|[^a-z0-9%+-]+$/g, '')
    .replace(/['’]s$/g, '');
}

/**
 * Phrase-aware & stem-aware keyword highlighter:
 * Matches BOTH single words ("discipline", "obsession") AND multi-word phrases
 * ("9 PM", "NO EXCUSES", "one more hour", "remember to be happy") cleanly across tokens!
 */
function markAccentPhrases(tokens, accentWords = []) {
  const phrases = [];
  for (const rawEntry of (accentWords || [])) {
    const parts = String(rawEntry || '')
      .split(/\s+/)
      .map(normWord)
      .filter(Boolean);
    if (parts.length > 0) phrases.push(parts);
  }

  const normToks = tokens.map((t) => (t.isSpeakerLabel ? '' : normWord(t.raw)));

  // Auto-highlight intentional ALL-CAPS emphasis words (>= 3 letters, e.g. "NEVER", "EVERYTHING")
  tokens.forEach((t) => {
    if (t.isSpeakerLabel) return;
    const letters = String(t.raw || '').replace(/[^A-Za-z]/g, '');
    if (letters.length >= 3 && letters === letters.toUpperCase()) {
      t.highlight = true;
    }
  });

  for (const ph of phrases) {
    const m = ph.length;
    for (let i = 0; i <= tokens.length - m; i++) {
      let ok = true;
      for (let k = 0; k < m; k++) {
        const cand = normToks[i + k];
        const targ = ph[k];
        if (!cand) {
          ok = false;
          break;
        }
        const exact = cand === targ;
        const stemMatch = m === 1 && targ.length >= 5 && (cand.startsWith(targ) || targ.startsWith(cand));
        if (!exact && !stemMatch) {
          ok = false;
          break;
        }
      }
      if (ok) {
        for (let k = 0; k < m; k++) {
          tokens[i + k].highlight = true;
        }
      }
    }
  }
  return tokens;
}

/**
 * Bridge micro-gaps (`<= 0.28s`) between consecutive spoken `WordBoundary` tokens inside the same cue
 * so the active-word cinema glow glides smoothly from word to word without strobing/flickering off!
 */
function bridgeContinuousWordGaps(tokens) {
  const spoken = tokens.filter(
    (t) => !t.isSpeakerLabel && !t.isPunctuationOnly && Number.isFinite(t.tStart) && Number.isFinite(t.tEnd)
  );
  for (let i = 0; i < spoken.length - 1; i++) {
    const cur = spoken[i];
    const nxt = spoken[i + 1];
    const gap = nxt.tStart - cur.tEnd;
    if (gap > -0.02 && gap <= 0.28) {
      cur.tEnd = +nxt.tStart.toFixed(3);
    } else if (gap < -0.02) {
      cur.tEnd = +Math.max(cur.tStart + 0.04, nxt.tStart).toFixed(3);
    }
  }
  return tokens;
}

function tokensMatchWord(cand, sub) {
  if (!cand || !sub) return false;
  if (cand === sub) return true;
  if (Math.min(cand.length, sub.length) >= 4) {
    return cand.startsWith(sub) || sub.startsWith(cand);
  }
  return false;
}

function mapDisplayTokensToWordTimings(displayTokens, rawWords, startSec, endSec, hasSpeakerPrefix = false) {
  const n = displayTokens.length;
  if (n === 0) return [];
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  const words = Array.isArray(rawWords) ? rawWords : [];
  let wIdx = 0;

  const mapped = displayTokens.map((tok, idx) => {
    if ((hasSpeakerPrefix && idx === 0) || tok.isSpeakerLabel) {
      return {
        ...tok,
        isSpeakerLabel: true,
        tStart: undefined,
        tEnd: undefined,
      };
    }
    const subParts = String(tok.raw || '')
      .split(/[-—/]+/)
      .map(norm)
      .filter(Boolean);

    if (subParts.length === 0) {
      return { ...tok, isPunctuationOnly: true, tStart: undefined, tEnd: undefined };
    }

    if (wIdx < words.length) {
      let matchStartIdx = -1;
      for (let look = wIdx; look < Math.min(words.length, wIdx + 5); look++) {
        const cand = norm(words[look].word);
        if (tokensMatchWord(cand, subParts[0])) {
          matchStartIdx = look;
          break;
        }
      }
      if (matchStartIdx !== -1) {
        let matchEndIdx = matchStartIdx;
        for (let p = 1; p < subParts.length && matchEndIdx + 1 < words.length; p++) {
          const nextCand = norm(words[matchEndIdx + 1].word);
          if (tokensMatchWord(nextCand, subParts[p])) {
            matchEndIdx++;
          }
        }
        wIdx = matchEndIdx + 1;
        return {
          ...tok,
          tStart: +Number(words[matchStartIdx].start).toFixed(3),
          tEnd: +Number(words[matchEndIdx].end).toFixed(3),
        };
      }
    }
    return { ...tok, tStart: null, tEnd: null };
  });

  // Fill any unmatched spoken tokens proportionally between anchored spoken neighbors
  let i = 0;
  while (i < n) {
    if (mapped[i].tStart !== null) {
      i++;
      continue;
    }
    let j = i;
    while (j < n && mapped[j].tStart === null) j++;
    let leftT = startSec;
    for (let k = i - 1; k >= 0; k--) {
      if (Number.isFinite(mapped[k].tEnd)) {
        leftT = mapped[k].tEnd;
        break;
      }
    }
    let rightT = endSec;
    for (let k = j; k < n; k++) {
      if (Number.isFinite(mapped[k].tStart)) {
        rightT = mapped[k].tStart;
        break;
      }
    }
    const span = Math.max(0.05, rightT - leftT);
    const count = j - i;
    for (let k = 0; k < count; k++) {
      const ts0 = leftT + (k / count) * span;
      const ts1 = leftT + ((k + 0.94) / count) * span;
      mapped[i + k].tStart = +ts0.toFixed(3);
      mapped[i + k].tEnd = +Math.max(ts0 + 0.04, ts1).toFixed(3);
    }
    i = j;
  }
  return bridgeContinuousWordGaps(mapped);
}

function splitIntoBalancedChunks(words) {
  const subChunks = [];
  let buf = [];
  let charLen = 0;

  // Chunk at punctuation first, and only hard-cut at the word/char cap as a last resort:
  // a cue should never begin mid-phrase (e.g. "river. Master Okoro gave her one rule.").
  const isSentenceEnd = (w) => /[.!?]["']?$/.test(w);
  const isClauseEnd = (w) => /[,;:\u2014-]$/.test(w);
  const HARD_WORDS = 11;
  const HARD_CHARS = 68;
  const FUNCTION_WORD_RE =
    /^(and|or|but|so|then|that|which|who|because|as|if|when|while|with|from|to|of|in|on|for|a|an|the|he|she|it|they|we|i|his|her|their|our|my|was|is|are|were|had|has|have|will|would|could|should|can|did|do|does|not)$/i;

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    buf.push(w);
    charLen += w.length + 1;

    if ((isSentenceEnd(w) && buf.length >= 2) || (isClauseEnd(w) && (buf.length >= 5 || charLen >= 34))) {
      subChunks.push(buf.join(' '));
      buf = [];
      charLen = 0;
      continue;
    }

    const hitCap = buf.length >= HARD_WORDS || charLen >= HARD_CHARS;
    if (!hitCap) continue;

    // Prefer cutting AFTER the most recent punctuation (so the cue keeps its comma/period)...
    let cutAfter = -1;
    for (let k = buf.length - 2; k >= 3; k--) {
      const token = words[i - (buf.length - 1 - k)];
      if (isSentenceEnd(token) && k >= 1) { cutAfter = k; break; }
      if (isClauseEnd(token) && k >= 4) { cutAfter = k; break; }
    }
    // ...otherwise cut BEFORE the nearest function word so the next cue starts on content.
    let cutBefore = -1;
    if (cutAfter < 0) {
      for (let k = buf.length - 2; k >= 4; k--) {
        if (FUNCTION_WORD_RE.test(words[i - (buf.length - 1 - k)])) { cutBefore = k; break; }
      }
    }

    if (cutAfter > 0 && cutAfter < buf.length - 1) {
      subChunks.push(buf.slice(0, cutAfter + 1).join(' '));
      buf = buf.slice(cutAfter + 1);
    } else if (cutBefore > 0) {
      subChunks.push(buf.slice(0, cutBefore).join(' '));
      buf = buf.slice(cutBefore);
    } else if (buf.length >= HARD_WORDS + 3 || charLen >= HARD_CHARS + 18) {
      subChunks.push(buf.join(' '));
      buf = [];
    } else {
      continue;
    }
    charLen = buf.reduce((acc, t) => acc + t.length + 1, 0);
  }

  if (buf.length > 0) {
    const last = subChunks.length > 0 ? subChunks[subChunks.length - 1] : '';
    if (last && buf.length <= 2 && last.length + buf.join(' ').length <= 52) {
      subChunks[subChunks.length - 1] += ' ' + buf.join(' ');
    } else {
      subChunks.push(buf.join(' '));
    }
  }
  return subChunks;
}

function buildSubtitlesFromLineTimings(lineTimings, accentWords = []) {
  const subs = [];
  for (const item of lineTimings) {
    const raw = String(item.text || '')
      .replace(/\s*—\s*/g, ' — ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!raw) continue;
    const speaker = item.speaker && item.speaker !== 'narrator' ? String(item.speaker).toUpperCase() : null;
    const lineWords = Array.isArray(item.words) ? item.words : [];

    const words = raw.split(' ');
    const subChunks = splitIntoBalancedChunks(words);

    const allDisplayTokens = [];
    const chunkRanges = [];
    subChunks.forEach((chunkText, cIdx) => {
      const hasSpk = Boolean(speaker && cIdx === 0);
      const rawToks = [];
      if (hasSpk) {
        rawToks.push({ raw: `${speaker}:`, highlight: true, _isPrefix: true });
      }
      chunkText.split(' ').forEach((tok) => {
        rawToks.push({ raw: tok, highlight: false, _isPrefix: false });
      });
      markAccentPhrases(rawToks, accentWords);
      const startIdx = allDisplayTokens.length;
      rawToks.forEach((rt) => allDisplayTokens.push(rt));
      chunkRanges.push({
        display: hasSpk ? `${speaker}: ${chunkText}` : chunkText,
        hasSpk,
        startIdx,
        endIdx: allDisplayTokens.length,
      });
    });

    const nonPrefix = allDisplayTokens.filter((t) => !t._isPrefix);
    const alignedNonPrefix = mapDisplayTokensToWordTimings(
      nonPrefix,
      lineWords,
      Number(item.start),
      Number(item.end),
      false
    );
    let npCursor = 0;
    const alignedAll = allDisplayTokens.map((t) => {
      if (t._isPrefix) {
        const firstT = alignedNonPrefix[0] ? alignedNonPrefix[0].tStart : Number(item.start);
        return {
          raw: t.raw,
          highlight: true,
          isSpeakerLabel: true,
          tStart: firstT,
          tEnd: +(firstT + 0.2).toFixed(3),
        };
      }
      return alignedNonPrefix[npCursor++];
    });

    chunkRanges.forEach((cr, cIdx) => {
      const slice = bridgeContinuousWordGaps(alignedAll.slice(cr.startIdx, cr.endIdx));
      const spokenSlice = slice.filter(
        (t) => !t.isSpeakerLabel && !t.isPunctuationOnly && Number.isFinite(t.tStart) && Number.isFinite(t.tEnd)
      );
      const lineSpeechEnd = Number(item.end);
      const cueStart = spokenSlice.length > 0 ? Math.max(0, spokenSlice[0].tStart - 0.03) : Number(item.start);
      const rawCueEnd = spokenSlice.length > 0 ? spokenSlice[spokenSlice.length - 1].tEnd : lineSpeechEnd;
      // Strict speech-synced cutoff: NEVER linger past the end of the voiced audio clip (`item.end`)!
      const cueEnd = Math.min(
        lineSpeechEnd,
        cIdx === chunkRanges.length - 1 ? rawCueEnd + 0.04 : rawCueEnd + 0.03
      );
      subs.push({
        text: cr.display,
        speaker,
        lineEnd: lineSpeechEnd,
        start: +cueStart.toFixed(3),
        end: +Math.min(lineSpeechEnd, Math.max(cueStart + 0.16, cueEnd)).toFixed(3),
        tokens: slice,
      });
    });
  }
  for (let i = 0; i < subs.length - 1; i++) {
    const gap = subs[i + 1].start - subs[i].end;
    if (gap < 0 || (gap <= 0.14 && subs[i].speaker === subs[i + 1].speaker && subs[i].end < subs[i].lineEnd)) {
      subs[i].end = +Math.min(subs[i].lineEnd, subs[i + 1].start).toFixed(3);
    }
  }
  return subs;
}

function buildCinemaSubtitles(narration, sceneDur, accentWords = [], wordTimings = null) {
  const raw = (narration || '')
    .replace(/\s*—\s*/g, ' — ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!raw) return [];

  const words = raw.split(' ');
  const chunks = splitIntoBalancedChunks(words);

  if (Array.isArray(wordTimings) && wordTimings.length > 0) {
    const allToks = chunks.flatMap((text) => {
      const toks = text.split(' ').map((tok) => ({ raw: tok, highlight: false }));
      return markAccentPhrases(toks, accentWords);
    });
    const lastWordEnd = Number.isFinite(Number(wordTimings[wordTimings.length - 1]?.end))
      ? Math.min(sceneDur, Number(wordTimings[wordTimings.length - 1].end))
      : sceneDur;
    const aligned = mapDisplayTokensToWordTimings(allToks, wordTimings, 0, lastWordEnd, false);
    let wCursor = 0;
    const built = chunks.map((text, idx) => {
      const cw = text.split(' ');
      const slice = bridgeContinuousWordGaps(aligned.slice(wCursor, wCursor + cw.length));
      wCursor += cw.length;
      const spokenSlice = slice.filter(
        (t) => !t.isSpeakerLabel && !t.isPunctuationOnly && Number.isFinite(t.tStart) && Number.isFinite(t.tEnd)
      );
      const s0 = spokenSlice.length > 0 ? Math.max(0, spokenSlice[0].tStart - 0.03) : 0;
      const e0 = spokenSlice.length > 0 ? spokenSlice[spokenSlice.length - 1].tEnd : lastWordEnd;
      // Never linger past `lastWordEnd`
      const endCapped = Math.min(lastWordEnd, e0 + (idx === chunks.length - 1 ? 0.04 : 0.03));
      return {
        text,
        start: +s0.toFixed(3),
        end: +Math.min(sceneDur, Math.max(s0 + 0.16, endCapped)).toFixed(3),
        tokens: slice,
      };
    });
    for (let i = 0; i < built.length - 1; i++) {
      const gap = built[i + 1].start - built[i].end;
      if (gap < 0 || gap <= 0.14) built[i].end = +Math.min(lastWordEnd, built[i + 1].start).toFixed(3);
    }
    return built;
  }

  const leadIn = Math.min(0.16, sceneDur * 0.04);
  // Estimate realistic spoken window (~2.65 words/sec) so subtitles disappear when speech finishes,
  // rather than lingering across silent visual tail beats!
  const estimatedSpeechSec = Math.max(0.55, words.length / 2.65);
  const tailGuard = Math.min(0.32, sceneDur * 0.08);
  const avail = Math.max(0.4, Math.min(sceneDur - leadIn - tailGuard, estimatedSpeechSec));
  const totalChars = Math.max(1, chunks.reduce((acc, c) => acc + c.length + 4, 0));

  let cursor = leadIn;
  return chunks.map((text) => {
    const share = ((text.length + 4) / totalChars) * avail;
    const start = cursor;
    const end = cursor + share;
    cursor = end;
    const rawToks = markAccentPhrases(
      text.split(' ').map((tok) => ({ raw: tok, highlight: false })),
      accentWords
    );
    return {
      text,
      start: +start.toFixed(3),
      end: +end.toFixed(3),
      tokens: bridgeContinuousWordGaps(mapDisplayTokensToWordTimings(rawToks, [], start, end, false)),
    };
  });
}

function compileEpisode(spec, options = {}) {
  const cfg = loadStudioConfig(options.configPath);
  const fps = options.fps || spec.fps || cfg.fps || 30;
  const W = options.width || cfg.width || 1920;
  const H = options.height || cfg.height || 1080;

  const warnings = [];
  const errors = [];

  if (!spec || typeof spec !== 'object') {
    throw new Error('Episode specification must be a valid JSON object.');
  }
  if (!Array.isArray(spec.scenes) || spec.scenes.length === 0) {
    throw new Error('Episode specification must contain a non-empty `scenes` array.');
  }

  // Dynamic Cast Registry — defined purely by the prompt/episode according to the script
  const cast = {};
  if (spec.cast && typeof spec.cast === 'object') {
    for (const [id, profile] of Object.entries(spec.cast)) {
      cast[id] = {
        id,
        name: profile.name || id.toUpperCase(),
        color: profile.color || 'cyan',
        style: profile.style || 'cel',
        build: profile.build || 'standard',
        hair: profile.hair !== undefined ? profile.hair : undefined,
        hairColor: profile.hair_color || profile.hairColor || null,
        shoeColor: profile.shoe_color || profile.shoeColor || null,
        accessory: profile.accessory || null,
        accessories: profile.accessories || null,
        eyes: profile.eyes ?? true,
        expression: profile.expression || null,
        posture: profile.posture ?? 0,
        outlineWidth: profile.outline_width || profile.outlineWidth || 'standard',
        coatColor: profile.coat_color || profile.coatColor || null,
        scarfColor: profile.scarf_color || profile.scarfColor || null,
        bagColor: profile.bag_color || profile.bagColor || null,
        voice: profile.voice || null,
        rate: profile.rate || null,
        scale: profile.scale ?? 1.0,
        accent: profile.accent || profile.accent_color || null,
      };
    }
  }

  const seenCastIds = new Set();
  const chapters = [];
  let cursorSec = 0;

  // Canonical Episode Asset & Prop Continuity Registry:
  // Preserves prop identity, scale, facing, coordinates, and moved/attached/opened state across cuts!
  const propRegistry = {};
  const continuityEvents = [];
  if (spec.assets && typeof spec.assets === 'object') {
    for (const [assetId, def] of Object.entries(spec.assets)) {
      if (!def || typeof def !== 'object') continue;
      propRegistry[assetId] = {
        ...def,
        id: assetId,
        scale: def.scale ?? (CANONICAL_ASSET_LIBRARY[def.type]?.defaultScale ?? 1.0),
      };
    }
  }
  let prevLocationId = null;

  const compiledScenes = spec.scenes.map((sc, idx) => {
    const id = sc.id || `S${String(idx + 1).padStart(2, '0')}`;
    const dur = Math.max(1.5, Number(sc.duration || 8.0));
    const startSec = cursorSec;
    const endSec = +(cursorSec + dur).toFixed(4);
    cursorSec = endSec;

    const startFrame = Math.round(startSec * fps);
    const endFrame = Math.max(startFrame + 1, Math.round(endSec * fps));

    const ENV_ALIASES = {
      studio: 'lecture_stage',
      dawn_road: 'sunrise_summit',
      city_rain: 'storm_road',
      night_office: 'modern_office',
    };
    let customSetting = sc.setting && typeof sc.setting === 'object'
      ? sc.setting
      : (sc.style === 'parchment' ? { style: 'parchment', backdrop: 'parchment_room' } : null);
    let envKey = sc.environment ? (ENV_ALIASES[sc.environment] || sc.environment) : null;
    if (!customSetting && !envKey) {
      envKey = 'modern_office';
    }
    if (!customSetting && envKey && !ENVIRONMENTS[envKey]) {
      warnings.push(`[${id}] Unknown environment "${envKey}" — falling back to "modern_office".`);
      envKey = 'modern_office';
    }

    const envMeta = customSetting
      ? {
          lightColor: customSetting.light_color || '#38bdf8',
          mood: sc.mood || customSetting.mood || 'focus',
        }
      : ENVIRONMENTS[envKey];

    const accentColor = sc.accent_color || sc.light_color || envMeta.lightColor;
    const settingSignature = customSetting
      ? `custom:${customSetting.backdrop || ''}:${(customSetting.sky || []).join(',')}`
      : `preset:${envKey}`;

    if (sc.chapter) {
      chapters.push({
        title: String(sc.chapter),
        startSec,
        sceneId: id,
        accentColor,
      });
    }

    const rawChars = Array.isArray(sc.characters) ? sc.characters : [];
    const characters = rawChars.map((ch, cIdx) => {
      const castProfile = ch.id && cast[ch.id] ? cast[ch.id] : {};
      const resolvedId = ch.id || `char_${cIdx + 1}`;
      const isFirstAppearance = Boolean(ch.id && cast[ch.id] && !seenCastIds.has(ch.id));
      if (ch.id) seenCastIds.add(ch.id);

      const merged = {
        ...castProfile,
        ...ch,
        id: resolvedId,
        color: ch.color || castProfile.color || 'cyan',
        style: ch.style || castProfile.style || 'cel',
        build: ch.build || castProfile.build || 'standard',
        hair: ch.hair !== undefined ? ch.hair : castProfile.hair,
        hairColor: ch.hair_color || ch.hairColor || castProfile.hairColor || null,
        shoeColor: ch.shoe_color || ch.shoeColor || castProfile.shoeColor || null,
        accessory: ch.accessory !== undefined ? ch.accessory : castProfile.accessory,
        accessories: ch.accessories !== undefined ? ch.accessories : castProfile.accessories,
        eyes: ch.eyes !== undefined ? ch.eyes : (castProfile.eyes ?? true),
        expression: ch.expression !== undefined ? ch.expression : castProfile.expression,
        posture: ch.posture !== undefined ? ch.posture : castProfile.posture,
        outlineWidth: ch.outline_width || ch.outlineWidth || castProfile.outlineWidth || 'standard',
        coatColor: ch.coat_color || ch.coatColor || castProfile.coatColor || null,
        scarfColor: ch.scarf_color || ch.scarfColor || castProfile.scarfColor || null,
        bagColor: ch.bag_color || ch.bagColor || castProfile.bagColor || null,
        from_t: ch.from_t,
        to_t: ch.to_t,
        scale: ch.scale ?? castProfile.scale ?? 1.0,
        showNameTag:
          ch.show_name !== undefined
            ? Boolean(ch.show_name)
            : Boolean(castProfile.show_name),
      };

      const ACTION_ALIASES = {
        type_desk: 'sit_desk_type',
        sit_type: 'sit_desk_type',
        sit_desk: 'sit_desk_type',
        celebrate: 'celebrate_arms_up',
      };
      if (merged.action && ACTION_ALIASES[merged.action]) {
        merged.action = ACTION_ALIASES[merged.action];
      }
      if (Array.isArray(merged.beats)) {
        merged.beats = merged.beats.map((b) => (
          b && b.action && ACTION_ALIASES[b.action] ? { ...b, action: ACTION_ALIASES[b.action] } : b
        ));
      }
      const actionsToCheck = Array.isArray(merged.beats)
        ? merged.beats.map((b) => b.action)
        : [merged.action || 'idle_stand'];
      for (const act of actionsToCheck) {
        if (act && !SUPPORTED_ACTIONS.includes(act)) {
          warnings.push(`[${id}:${resolvedId}] Unknown action "${act}" — using idle_stand.`);
        }
      }
      return merged;
    });

    const PROP_ALIASES = {
      staircase: 'stairs',
    };
    const sceneLocationId = sc.location_id || sc.room_id || null;
    const rawPropsList = Array.isArray(sc.props) ? sc.props.map((p) => ({ ...p })) : [];

    // If situated inside a named `location_id` (and `inherit_props !== false`),
    // automatically carry forward persistent canonical props from `propRegistry` for that location
    // across both adjacent shots AND cross-cuts!
    if (sceneLocationId && sc.inherit_props !== false) {
      for (const [regId, regProp] of Object.entries(propRegistry)) {
        if (regProp._locationId !== sceneLocationId) continue;
        if (!rawPropsList.some((rp) => rp && rp.id === regId)) {
          rawPropsList.push({ ...regProp, _inherited: true });
          continuityEvents.push({ sceneId: id, propId: regId, event: 'inherited_across_cut' });
        }
      }
    }

    const props = rawPropsList.map((rawP) => {
      let p = rawP && rawP.type && PROP_ALIASES[rawP.type] ? { ...rawP, type: PROP_ALIASES[rawP.type] } : { ...rawP };
      if (p.id && propRegistry[p.id]) {
        const reg = propRegistry[p.id];
        const allowOverride = Boolean(p.allow_override || sc.allow_prop_override);
        const keepMovedX = reg._movedByInteraction && !allowOverride && (rawP._inherited || rawP.x === undefined || rawP.x === reg._initialX);
        const keepMovedElev = reg._movedByInteraction && !allowOverride && (rawP._inherited || rawP.elevation === undefined || rawP.elevation === reg._initialElevation);
        const keepOpenState = reg._openedByInteraction && !allowOverride && (rawP._inherited || rawP.open_amount === undefined);
        // Hydrate identity & persisted moved/opened/attached state from canonical registry
        p = {
          ...reg,
          ...p,
          type: allowOverride ? (p.type || reg.type) : reg.type,
          scale: allowOverride && p.scale !== undefined ? p.scale : (reg.scale ?? p.scale ?? 1.0),
          facing: allowOverride && p.facing !== undefined ? p.facing : (reg.facing ?? p.facing),
          x: keepMovedX ? reg.x : (p.x !== undefined ? p.x : reg.x),
          elevation: keepMovedElev ? reg.elevation : (p.elevation !== undefined ? p.elevation : reg.elevation),
          open_amount: keepOpenState ? reg.open_amount : (p.open_amount !== undefined ? p.open_amount : reg.open_amount),
          _attachedToActor: p.detached ? null : (p._attachedToActor ?? reg._attachedToActor ?? null),
        };
      }
      if (p.type && !SUPPORTED_PROPS.includes(p.type)) {
        warnings.push(`[${id}] Unknown prop type "${p.type}".`);
      }
      if (p.id) {
        const prevReg = propRegistry[p.id];
        propRegistry[p.id] = {
          ...p,
          _initialX: prevReg ? prevReg._initialX : p.x,
          _initialElevation: prevReg ? prevReg._initialElevation : p.elevation,
          _locationId: sceneLocationId || prevReg?._locationId || null,
        };
      }
      return p;
    });

    // Evaluate deterministic end-of-scene interaction state so moved props, opened doors,
    // and held objects persist accurately into subsequent shots!
    if (props.some((p) => p && p.id) && characters.length > 0) {
      const endTs = Math.max(0, dur - 0.001);
      const endChars = characters
        .filter((actor) => (actor.from_t === undefined || endTs >= actor.from_t) && (actor.to_t === undefined || endTs <= actor.to_t))
        .map((actor) => ({
          actor,
          state: evaluateCharacterState(actor, endTs, dur, startSec + endTs, 1920, 855, null),
        }));
      const endProps = resolveScenePropInteractions(props, endChars, characters, endTs, dur, 1920, 855);
      for (const ep of endProps) {
        if (ep && ep.id && propRegistry[ep.id]) {
          const prev = propRegistry[ep.id];
          const moved = (ep.x !== undefined && Math.abs((ep.x ?? 0) - (prev.x ?? 0)) > 1e-6) ||
                        (ep.elevation !== undefined && Math.abs((ep.elevation ?? 0) - (prev.elevation ?? 0)) > 1e-6);
          const opened = ep.open_amount !== undefined && Math.abs((ep.open_amount ?? 0) - (prev.open_amount ?? 0)) > 1e-6;
          propRegistry[ep.id] = {
            ...prev,
            x: ep.x,
            elevation: ep.elevation,
            open_amount: ep.open_amount,
            _movedByInteraction: Boolean(prev._movedByInteraction || moved),
            _openedByInteraction: Boolean(prev._openedByInteraction || opened),
            _attachedToActor: ep._attachedToActor || null,
          };
        }
      }
    }
    prevLocationId = sceneLocationId;

    // Auto-bind `stairs` geometry (`stair_scale`, `stairs_x`, `steps`, `dir`) onto `climb_stairs` / `descend_stairs` beats
    const stairsProp = props.find((p) => p && p.type === 'stairs');
    if (stairsProp) {
      for (const ch of characters) {
        if (Array.isArray(ch.beats)) {
          ch.beats = ch.beats.map((b) => {
            if (!b || (b.action !== 'climb_stairs' && b.action !== 'descend_stairs')) return b;
            return {
              ...b,
              stairs_x: b.stairs_x ?? stairsProp.x ?? 0.35,
              stair_scale: b.stair_scale ?? stairsProp.scale ?? 1.0,
              steps: b.steps ?? stairsProp.steps ?? 5,
              dir: b.dir ?? stairsProp.dir ?? 'right',
            };
          });
        }
      }
    }

    const resolvedBoard = sc.board || sc.visual_board || null;
    if (resolvedBoard && resolvedBoard.type && !SUPPORTED_BOARDS.includes(resolvedBoard.type)) {
      warnings.push(`[${id}] Unknown board type "${resolvedBoard.type}".`);
    }

    const combinedNarration = sc.narration ||
      (Array.isArray(sc.dialogue)
        ? sc.dialogue.map((d) => d.text || '').filter(Boolean).join(' ')
        : '');

    const subtitles = Array.isArray(sc.line_timings) && sc.line_timings.length > 0
      ? buildSubtitlesFromLineTimings(sc.line_timings, sc.accent_words || [])
      : buildCinemaSubtitles(
          combinedNarration,
          dur,
          sc.accent_words || [],
          sc.word_timings || null
        );

    const cam = sc.camera || {};
    const focusXBase = cam.focus_x ?? cam.focusX ?? 0.5;
    const focusYBase = cam.focus_y ?? cam.focusY ?? 0.54;
    const camera = {
      // KI-018b: this used to default zoomTo to 1.04, so EVERY scene without an authored
      // camera block silently crept 4% over its whole duration. That made an intentionally
      // still scene impossible to author, and hid real stillness from creative_review (the
      // creep's frame delta sits above its 0.0015 "still" bar). Default to a hold; a scene
      // that wants motion says so.
      zoomFrom: cam.zoom_from ?? cam.zoomFrom ?? 1.0,
      zoomTo: cam.zoom_to ?? cam.zoomTo ?? (cam.zoom_from ?? cam.zoomFrom ?? 1.0),
      panFrom: cam.pan_from ?? cam.panFrom ?? 0.0,
      panTo: cam.pan_to ?? cam.panTo ?? 0.0,
      focusXFrom: cam.focus_x_from ?? cam.focusXFrom ?? focusXBase,
      focusXTo: cam.focus_x_to ?? cam.focusXTo ?? focusXBase,
      focusYFrom: cam.focus_y_from ?? cam.focusYFrom ?? focusYBase,
      focusYTo: cam.focus_y_to ?? cam.focusYTo ?? focusYBase,
      moveDur: cam.move_dur !== undefined ? Number(cam.move_dur) : null,
    };

    const portraitFocus = sc.portrait_focus !== undefined && sc.portrait_focus !== null
      ? String(sc.portrait_focus)
      : null;
    let portraitFocusX = null;
    if (sc.portrait_focus_x !== undefined) {
      const rawPortraitFocusX = Number(sc.portrait_focus_x);
      if (Number.isFinite(rawPortraitFocusX) && rawPortraitFocusX >= 0 && rawPortraitFocusX <= 1) {
        portraitFocusX = rawPortraitFocusX;
      } else {
        warnings.push(`[${id}] portrait_focus_x must be a normalized value from 0 to 1; automatic portrait framing will be used.`);
      }
    }
    if (portraitFocus && portraitFocus !== 'board' && !characters.some((ch) => String(ch.id) === portraitFocus)) {
      warnings.push(`[${id}] portrait_focus "${portraitFocus}" does not match a character id or "board"; automatic portrait framing will be used.`);
    }

    const cameraShots = Array.isArray(sc.camera_shots) && sc.camera_shots.length > 0
      ? sc.camera_shots.map((sh) => {
          const fx = sh.focus_x ?? sh.focusX ?? 0.5;
          const fy = sh.focus_y ?? sh.focusY ?? 0.62;
          return {
            start: Number(sh.start ?? 0),
            end: Number(sh.end ?? dur),
            zoomFrom: Number(sh.zoom_from ?? sh.zoomFrom ?? sh.zoom ?? 1.15),
            zoomTo: Number(sh.zoom_to ?? sh.zoomTo ?? sh.zoom ?? sh.zoom_from ?? 1.18),
            panFrom: Number(sh.pan_from ?? sh.panFrom ?? 0.0),
            panTo: Number(sh.pan_to ?? sh.panTo ?? 0.0),
            focusXFrom: Number(sh.focus_x_from ?? sh.focusXFrom ?? fx),
            focusXTo: Number(sh.focus_x_to ?? sh.focusXTo ?? fx),
            focusYFrom: Number(sh.focus_y_from ?? sh.focusYFrom ?? fy),
            focusYTo: Number(sh.focus_y_to ?? sh.focusYTo ?? fy),
            moveDur: sh.move_dur !== undefined ? Number(sh.move_dur) : null,
            cut: sh.cut !== false,
            blendSec: Number(sh.blend_sec ?? sh.blendSec ?? 0.55),
          };
        })
      : null;

    return {
      index: idx,
      id,
      duration: dur,
      startSec,
      endSec,
      startFrame,
      endFrame,
      environment: envKey || 'custom',
      setting: customSetting,
      settingSignature,
      foreground: sc.foreground || null,
      intertitle: sc.intertitle || null,
      flashbackWindow: sc.flashback_window || null,
      windBlackoutAt: sc.wind_blackout_at !== undefined ? Number(sc.wind_blackout_at) : null,
      cutToBlackAt: sc.cut_to_black_at !== undefined ? Number(sc.cut_to_black_at) : null,
      splitScreen: sc.split_screen || null,
      endCard: sc.end_card || null,
      fadeToBlack: Boolean(sc.fade_to_black),
      mood: sc.mood || envMeta.mood || 'focus',
      bgmTrack: sc.bgm || sc.bgm_track || null,
      bgmGain: sc.bgm_gain ?? 1.0,
      bgmOffset: sc.bgm_offset ?? 0.0,
      bgmFadeOut: Boolean(sc.bgm_fade_out),
      accentColor,
      chapter: sc.chapter || null,
      narration: combinedNarration,
      dialogue: sc.dialogue || null,
      lineTimings: Array.isArray(sc.line_timings) ? sc.line_timings : [],
      wordTimings: Array.isArray(sc.word_timings) ? sc.word_timings : [],
      subtitles,
      characters,
      props,
      board: resolvedBoard,
      boards: Array.isArray(sc.boards) ? sc.boards : (resolvedBoard ? [resolvedBoard] : []),
      camera,
      cameraShots,
      portraitFocus,
      portraitFocusX,
      sfx: Array.isArray(sc.sfx) ? sc.sfx : [],
    };
  });

  let outro = null;
  if (spec.outro !== false && (spec.outro || spec.include_outro)) {
    const oDur = Number((spec.outro && spec.outro.duration) || 4.5);
    const startSec = cursorSec;
    const endSec = +(cursorSec + oDur).toFixed(4);
    cursorSec = endSec;
    outro = {
      title: (spec.outro && spec.outro.title) || spec.thesis || spec.title || '',
      subtitle: (spec.outro && spec.outro.subtitle) || spec.channel_name || cfg.channel_name || '',
      accentColor: (spec.outro && spec.outro.accent_color) || '#38bdf8',
      startSec,
      endSec,
      startFrame: Math.round(startSec * fps),
      endFrame: Math.round(endSec * fps),
      duration: oDur,
    };
  }

  const totalDuration = +cursorSec.toFixed(3);
  const totalFrames = Math.max(1, Math.round(totalDuration * fps));

  if (chapters.length === 0 && compiledScenes.length > 0) {
    chapters.push({
      title: spec.title || 'Opening',
      startSec: 0,
      sceneId: compiledScenes[0].id,
      accentColor: compiledScenes[0].accentColor,
    });
  }

  const soundEvents = [];
  for (const sc of compiledScenes) {
    if (sc.chapter && sc.index > 0) {
      soundEvents.push({ t: +(sc.startSec + 0.08).toFixed(3), type: 'chapter_chime', pan: 0.0 });
    } else if (sc.index > 0 && sc.settingSignature !== compiledScenes[sc.index - 1].settingSignature) {
      soundEvents.push({ t: +sc.startSec.toFixed(3), type: 'room_shift', pan: 0.0 });
    }

    const sceneBoards = Array.isArray(sc.boards) && sc.boards.length > 0 ? sc.boards : (sc.board ? [sc.board] : []);
    for (const bd of sceneBoards) {
      const rev = bd.reveal_at ?? bd.appear_at ?? bd.start_at ?? 0.35;
      soundEvents.push({
        t: +(sc.startSec + rev).toFixed(3),
        type: bd.type === 'phone_card' ? 'phone_buzz' : 'board_pop',
        pan: ((bd.x ?? 0.55) - 0.5) * 1.1,
      });
    }

    for (const ch of sc.characters) {
      const steps = extractCharacterFootsteps(ch, sc.startSec, sc.duration, W);
      soundEvents.push(...steps);

      // Subtle automatic foley synchronized to physical object & furniture contact
      if (sc.auto_interaction_sfx !== false) {
        const beatList = Array.isArray(ch.beats)
          ? ch.beats
          : [{ start: 0, end: sc.duration, action: ch.action || 'idle_stand' }];
        for (const bt of beatList) {
          if (!bt) continue;
          const b0 = Number(bt.start ?? 0);
          const b1 = Number(bt.end ?? sc.duration);
          const span = Math.max(0.2, b1 - b0);
          const pan = ((Number(bt.x ?? ch.x ?? 0.5) - 0.5) * 1.1);
          if (bt.action === 'pick_up_phone') {
            soundEvents.push({ t: +(sc.startSec + b0 + span * 0.44).toFixed(3), type: 'phone_pickup', pan });
          } else if (bt.action === 'put_down_phone') {
            soundEvents.push({ t: +(sc.startSec + b0 + span * 0.42).toFixed(3), type: 'phone_setdown', pan });
          } else if (bt.action === 'open_door') {
            soundEvents.push({ t: +(sc.startSec + b0 + span * 0.34).toFixed(3), type: 'door_open', pan });
          } else if (bt.action === 'sit_down') {
            soundEvents.push({ t: +(sc.startSec + b0 + span * 0.62).toFixed(3), type: 'chair_sit', pan });
          }
        }
      }
    }

    for (const cue of sc.sfx) {
      if (typeof cue === 'string') {
        soundEvents.push({ t: +(sc.startSec + 0.4).toFixed(3), type: cue, pan: 0 });
      } else if (cue && cue.type) {
        soundEvents.push({
          t: +(sc.startSec + Number(cue.at || 0.3)).toFixed(3),
          type: cue.type,
          pan: Number(cue.pan || 0),
        });
      }
    }
  }
  soundEvents.sort((a, b) => a.t - b.t);

  const explicitFormat =
    options.explicitFormat ||
    spec.explicit_format ||
    spec.video_format_override ||
    (spec.format_policy && spec.format_policy.overridden ? spec.format_policy.format : null) ||
    null;
  const formatPolicy = selectVideoFormatForDuration(totalDuration, {
    explicitFormat,
    draft: Boolean(options.draft),
  });
  const notices = [];
  if (formatPolicy.overridden && formatPolicy.overrideNotice) {
    notices.push(formatPolicy.overrideNotice);
  }

  return {
    title: spec.title || 'Animated Story Episode',
    thesis: spec.thesis || '',
    bgm: spec.bgm || cfg.bgm_default || 'auto',
    channelName: spec.channel_name !== undefined ? spec.channel_name : (cfg.channel_name || ''),
    subtitlesMode: options.subtitlesMode || spec.subtitles_mode || cfg.subtitles_default || 'cinema',
    fps,
    width: W,
    height: H,
    totalDuration,
    totalFrames,
    formatPolicy,
    notices,
    propRegistry,
    continuityEvents,
    cast,
    chapters,
    scenes: compiledScenes,
    outro,
    soundEvents,
    warnings,
    errors,
    availablePalettes: Object.keys(PALETTES),
    availableEnvironments: Object.keys(ENVIRONMENTS),
  };
}

function formatYouTubeChapters(episode) {
  const fmt = (sec) => {
    const s = Math.max(0, Math.floor(sec));
    const m = Math.floor(s / 60);
    const r = s % 60;
    const h = Math.floor(m / 60);
    if (h > 0) {
      return `${h}:${String(m % 60).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
    }
    return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  };
  const list = [...episode.chapters];
  if (list.length > 0 && list[0].startSec > 0) {
    list[0] = { ...list[0], startSec: 0 };
  }
  return list.map((c) => `${fmt(c.startSec)} ${c.title}`).join('\n') + '\n';
}

module.exports = {
  loadStudioConfig,
  markAccentPhrases,
  mapDisplayTokensToWordTimings,
  bridgeContinuousWordGaps,
  buildCinemaSubtitles,
  buildSubtitlesFromLineTimings,
  compileEpisode,
  formatYouTubeChapters,
};
