#!/usr/bin/env python3
"""Author "The Wall You Agreed With" — a 45-second parchment-and-ink short.

One source of truth for the episode: scene timing, every beat, every prop window, every caption
and every sound cue are derived from the constants at the top, so the cut can be re-timed by
editing numbers instead of hunting through a 900-line JSON.

    python3 work/build_wall_episode.py [out.json]
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# --- the film ---------------------------------------------------------------------------------
TITLE = "The Wall You Agreed With"
THESIS = (
    "A limit is not a property of the world. It is a decision someone made, usually quietly, "
    "usually about themselves — and decisions can be un-made."
)

# --- frame-dependent geometry ---------------------------------------------------------------
# The film is authored once and emitted twice. A vertical Short is not a cropped landscape: the
# cast, the wall and the caption block all have to be re-scaled to the taller canvas.
CAST_SCALE = 1.0
WALL_H = 300
WALL_W = 158
SHOCK_H = 505
CAPTION_Y = 150
CAPTION_SIZE = 84

WALL_X = 0.615          # where the wall stands, as a fraction of frame width
WALL_W_LAND = 158       # landscape wall width in px, used for the portrait re-block
FLOOR = 855

SCENES = [
    # ---------------------------------------------------------------------------------------
    # 1. HOOK — he walks, the wall stops him, he bounces back.
    {
        "id": "S01",
        "dur": 5.2,
        "mood": "energetic",
        "bgm": "electronic_drive",
        "bgm_gain": 0.90,
        "caption": ("He hit", "a wall.", 0.30, 4.75),
        "narration": "He hit a wall.",
        "lead_in": 1.35,
        "hour": "day",
        "tint": None,
        "props": [
            {"type": "wall_slab", "x": WALL_X, "mode": "ghost", "height": WALL_H, "width": WALL_W, "hit_ats": [1.92]},
            {"type": "impact_star", "x": WALL_X, "at": 1.92, "h_frac": 1.0, "dx": -18},
        ],
        "beats": [
            {"start": 0.00, "end": 1.86, "action": "walk", "from_x": 0.075, "to_x": 0.545, "facing": 1},
            {"start": 1.86, "end": 2.72, "action": "trip_stumble", "x": 0.545, "facing": 1},
            {"start": 2.72, "end": 5.20, "action": "idle_stand", "x": 0.505, "facing": 1},
        ],
        "sfx": [{"type": "body_thud", "at": 1.92, "pan": 0.12}],
        "shots": [
            {"start": 0.0, "zoom_from": 1.02, "zoom_to": 1.06, "focus_x": 0.42, "focus_y": 0.58},
            {"cue_on": "He hit", "zoom_from": 1.06, "zoom_to": 1.15, "focus_x": 0.58, "focus_y": 0.58,
             "move_dur": 1.6},
        ],
    },
    # ---------------------------------------------------------------------------------------
    # 2. DENIAL — push, kick, give up. Music drops out; the trombone does the talking.
    {
        "id": "S02",
        "dur": 6.6,
        "mood": "calm",
        "bgm": "reflective_piano",
        "bgm_gain": 0.42,
        "caption": ("So he assumed it was", "permanent.", 0.30, 6.10),
        "narration": "So he assumed it was permanent.",
        "lead_in": 0.50,
        "hour": "day",
        "tint": None,
        "props": [
            {"type": "wall_slab", "x": WALL_X, "mode": "ghost", "height": WALL_H, "width": WALL_W, "hit_ats": [1.55, 3.05]},
            {"type": "impact_star", "x": WALL_X, "at": 1.55, "h_frac": 0.97, "dx": -14},
            {"type": "impact_star", "x": WALL_X, "at": 3.05, "h_frac": 0.83, "dx": -10},
        ],
        "beats": [
            {"start": 0.00, "end": 1.55, "action": "push_boulder", "x": 0.548, "facing": 1, "posture": -0.1, "hide_boulder": True},
            {"start": 1.55, "end": 3.05, "action": "push_boulder", "x": 0.552, "facing": 1, "posture": -0.22, "hide_boulder": True},
            {"start": 3.05, "end": 4.05, "action": "jump", "x": 0.552, "facing": 1},
            {"start": 4.05, "end": 6.60, "action": "kneel_exhausted", "x": 0.545, "facing": 1},
        ],
        "sfx": [
            {"type": "body_thud", "at": 1.55, "pan": 0.10},
            {"type": "body_thud", "at": 3.06, "pan": 0.10},
            {"type": "trombone_sad", "at": 4.15, "pan": -0.05},
        ],
        "shots": [
            {"start": 0.0, "zoom_from": 1.04, "zoom_to": 1.10, "focus_x": 0.52, "focus_y": 0.58},
            {"cue_on": "permanent", "zoom_from": 1.12, "zoom_to": 1.20, "focus_x": 0.56, "focus_y": 0.62,
             "move_dur": 1.8},
        ],
    },
    # ---------------------------------------------------------------------------------------
    # 3. THE OTHER ONE — walks straight through. Record scratch. This is the hinge of the film.
    {
        "id": "S03",
        "dur": 7.6,
        "mood": "modern",
        "bgm": "electronic_drive",
        "bgm_gain": 0.66,
        "caption": ("Same wall.", "Different belief.", 0.30, 7.15),
        "narration": "Same wall. Different belief.",
        "lead_in": 3.70,
        "hour": "day",
        "tint": None,
        "props": [
            {"type": "wall_slab", "x": WALL_X, "mode": "ghost", "height": WALL_H, "width": WALL_W, "shimmer_offset": 0.4},
            {"type": "wall_ripple", "x": WALL_X, "at_many": [4.92]},
        ],
        "beats_first": [
            {"start": 0.00, "end": 2.10, "action": "kneel_exhausted", "x": 0.545, "facing": 1},
            {"start": 2.10, "end": 4.55, "action": "kneel_lookup", "x": 0.545, "facing": 1},
            {"start": 4.55, "end": 7.60, "action": "idle_stand", "x": 0.545, "facing": 1, "posture": 0.15},
        ],
        "beats_second": [
            {"start": 0.00, "end": 4.90, "action": "walk", "from_x": 0.045, "to_x": 0.845, "facing": 1},
            {"start": 4.90, "end": 7.60, "action": "look_horizon", "x": 0.845, "facing": 1},
        ],
        "shock_at": 4.95,
        "sfx": [
            {"type": "record_scratch", "at": 4.92, "pan": 0.0},
            {"type": "chapter_chime", "at": 5.05, "pan": 0.2},
        ],
        "shots": [
            {"start": 0.0, "zoom_from": 1.05, "zoom_to": 1.09, "focus_x": 0.44, "focus_y": 0.60},
            {"cue_on": "Different belief", "zoom_from": 1.10, "zoom_to": 1.18, "focus_x": 0.62, "focus_y": 0.58,
             "move_dur": 1.8},
        ],
    },
    # ---------------------------------------------------------------------------------------
    # 4. MONTAGE — three ways through, three cuts, on the beat.
    {
        "id": "S04",
        "dur": 10.2,
        "mood": "energetic",
        "bgm": "upbeat_ncs_synth",
        "bgm_gain": 1.0,
        "caption": ("Limits are usually agreements we made", "quietly.", 0.25, 9.70),
        "narration": "Limits are usually agreements we made quietly.",
        "lead_in": 5.90,
        "hour": "day",
        "tint": None,
        "props": [
            {"type": "wall_slab", "x": WALL_X, "mode": "ghost", "height": WALL_H, "width": WALL_W, "from_t": 0.0, "to_t": 3.35},
            {"type": "chalk_door", "x": WALL_X, "at": 0.55, "from_t": 0.0, "to_t": 3.35},
            {"type": "box_stack", "x": 0.505, "count": 3, "from_t": 3.35, "to_t": 6.75},
            {"type": "wall_slab", "x": WALL_X, "mode": "ghost", "height": WALL_H, "width": WALL_W, "from_t": 3.35, "to_t": 6.75,
             "shimmer_offset": 0.7},
        ],
        "beats": [
            # A — sketches a door on the wall, then walks through it.
            {"start": 0.00, "end": 1.45, "action": "write_board", "x": 0.435, "facing": 1},
            {"start": 1.45, "end": 3.35, "action": "walk", "from_x": 0.435, "to_x": 0.865, "facing": 1},
            # B — stacks boxes against it, then vaults over. Two jumps read as one climb.
            {"start": 3.35, "end": 4.35, "action": "walk", "from_x": 0.185, "to_x": 0.495, "facing": 1},
            {"start": 4.35, "end": 5.10, "action": "jump", "x": 0.495, "facing": 1},
            {"start": 5.10, "end": 6.75, "action": "walk", "from_x": 0.545, "to_x": 0.865, "facing": 1},
            # C — turns around and simply leaves the other way.
            {"start": 6.75, "end": 7.85, "action": "walk", "from_x": 0.215, "to_x": 0.505, "facing": 1},
            {"start": 7.85, "end": 10.20, "action": "walk", "from_x": 0.505, "to_x": 0.055, "facing": -1},
        ],
        "sfx": [
            {"type": "beat_drop", "at": 0.02, "pan": 0.0},
            {"type": "paper_slide", "at": 0.60, "pan": -0.2},
            {"type": "body_thud", "at": 3.40, "pan": 0.15},
            {"type": "body_thud", "at": 3.62, "pan": 0.15},
            {"type": "chapter_chime", "at": 6.78, "pan": -0.25},
        ],
        "shots": [
            {"start": 0.0, "zoom_from": 1.04, "zoom_to": 1.08, "focus_x": 0.50, "focus_y": 0.58},
            {"cue_on": "quietly", "zoom_from": 1.10, "zoom_to": 1.16, "focus_x": 0.60, "focus_y": 0.58,
             "move_dur": 1.6},
        ],
    },
    # ---------------------------------------------------------------------------------------
    # 5. THE TURN — he stands, hesitates, steps through, freezes, and looks at us.
    {
        "id": "S05",
        "dur": 9.2,
        "mood": "calm",
        "bgm": "reflective_piano",
        "bgm_gain": 0.42,
        "caption": ("The only wall that ever stopped you", "was the one you agreed with.", 0.30, 8.70),
        "caption_size": 62,
        "narration": "The only wall that ever stopped you was the one you agreed with.",
        "lead_in": 2.90,
        "hour": "dusk",
        "tint": None,
        "props": [
            {"type": "wall_slab", "x": WALL_X, "mode": "ghost", "height": WALL_H, "width": WALL_W, "shimmer_offset": 0.15},
            {"type": "wall_ripple", "x": WALL_X, "at_many": [5.35]},
        ],
        "beats": [
            {"start": 0.00, "end": 2.05, "action": "stand_up_resolve", "x": 0.545, "facing": 1},
            {"start": 2.05, "end": 3.05, "action": "idle_stand", "x": 0.545, "facing": 1, "posture": 0.05},
            {"start": 3.05, "end": 5.45, "action": "walk", "from_x": 0.545, "to_x": 0.775, "facing": 1},
            {"start": 5.45, "end": 9.20, "action": "idle_stand", "x": 0.775, "facing": 1, "posture": 0.2},
        ],
        "sfx": [
            {"type": "body_thud", "at": 1.90, "pan": -0.08},
            {"type": "final_piano_note", "at": 5.45, "pan": 0.0},
        ],
        "shots": [
            {"start": 0.0, "zoom_from": 1.06, "zoom_to": 1.11, "focus_x": 0.52, "focus_y": 0.60},
            {"cue_on": "was the one", "zoom_from": 1.12, "zoom_to": 1.20, "focus_x": 0.66, "focus_y": 0.58,
             "move_dur": 2.0},
            {"cue_on": "you agreed with", "zoom_from": 1.20, "zoom_to": 1.28, "focus_x": 0.735, "focus_y": 0.56,
             "move_dur": 2.4, "cut": False},
        ],
    },
    # ---------------------------------------------------------------------------------------
    # 6. CTA — both walking out, the question, the follow line, fade.
    {
        "id": "S06",
        "dur": 7.2,
        "mood": "reflective",
        "bgm": "reflective_piano",
        "bgm_gain": 0.72,
        "caption": ("What wall are you still", "agreeing with?", 0.35, 7.00),
        "follow_caption": ("", "Follow for tomorrow's lesson.", 4.55, 6.95),
        "narration": "What wall are you still agreeing with?",
        "lead_in": 0.55,
        "hour": "dusk",
        "tint": None,
        "fade_to_black": True,
        "hold_silent_tail": True,
        "props": [],
        "beats_first": [
            {"start": 0.00, "end": 1.10, "action": "idle_stand", "x": 0.60, "facing": 1, "posture": 0.15},
            {"start": 1.10, "end": 3.75, "action": "walk", "from_x": 0.60, "to_x": 0.985, "facing": 1},
        ],
        "beats_second": [
            {"start": 0.00, "end": 1.70, "action": "idle_stand", "x": 0.715, "facing": 1, "posture": 0.1},
            {"start": 1.70, "end": 4.05, "action": "walk", "from_x": 0.715, "to_x": 1.045, "facing": 1},
        ],
        "sfx": [
            {"type": "chapter_chime", "at": 4.60, "pan": 0.0},
        ],
        "shots": [
            {"start": 0.0, "zoom_from": 1.03, "zoom_to": 1.08, "focus_x": 0.55, "focus_y": 0.58},
        ],
    },
]

ACCENT = "#a8322c"
BGM_OFFSETS = {'S01': 45, 'S03': 90, 'S04': 30, 'S02': 45, 'S05': 60, 'S06': 30}



def remap_x(x: float, half_w_land: float, half_w_port: float) -> float:
    """Re-block a landscape-authored x for the portrait wall.

    The wall got wider, so positions must be pushed outward *from its faces*, not rescaled about
    its centre — otherwise a character who stopped just short of the wall ends up standing inside
    it. Gaps outside each face are preserved and the result is clamped to the safe stage.
    """
    face_l, face_r = WALL_X - half_w_land, WALL_X + half_w_land
    p_l, p_r = WALL_X - half_w_port, WALL_X + half_w_port
    if x < WALL_X:
        return max(0.045, p_l - (face_l - x))
    return min(0.955, p_r + (x - face_r))


def build(portrait: bool = False) -> dict:
    # A vertical frame is 1080x1920: the world is authored 1920 wide, so the cast has to be drawn
    # larger to occupy the taller canvas. Landscape keeps the original 1.0.
    global CAST_SCALE, WALL_H, WALL_W, SHOCK_H, CAPTION_Y, CAPTION_SIZE
    if portrait:
        CAST_SCALE, WALL_H, WALL_W = 1.62, 760, 300
        SHOCK_H, CAPTION_Y, CAPTION_SIZE = 900, 150, 74
    else:
        CAST_SCALE, WALL_H, WALL_W = 1.00, 300, 158
        SHOCK_H, CAPTION_Y, CAPTION_SIZE = 505, 150, 84

    spec = {
        "title": TITLE,
        "channel_name": "",
        "thesis": THESIS,
        "bgm": "dynamic",
        "subtitles_mode": "off",
        "outro": False,
        "voices": {
            "narrator": {"voice": "en_US-ryan-medium", "rate": "+4%"},
        },
        "cast": {
            "first": {
                "name": "THE ONE WHO AGREED",
                "style": "ink_stick",
                "expression": "neutral",
                "scale": CAST_SCALE,
                "show_name": False,
            },
            "second": {
                "name": "THE ONE WHO DIDN'T",
                "style": "ink_stick",
                "expression": "smile",
                "scale": CAST_SCALE * 1.04,
                "show_name": False,
            },
        },
        "scenes": [],
    }

    for sc in SCENES:
        scene = {
            "id": sc["id"],
            "mood": sc["mood"],
            "accent_color": ACCENT,
            "duration": sc["dur"],
            "min_duration": sc["dur"],
            "lead_in": sc["lead_in"],
            "tail_out": 0.42,
            "setting": {
                "backdrop": "parchment_wall",
                "hour": sc["hour"],
                # Fog/rain off: this is a bare stage, weather would add noise.
                "fog": 0.0,
            },
            "props": list(sc.get("props") or []),
            "camera_shots": sc["shots"],
            "accent_words": [],
            "sfx": sc.get("sfx") or [],
            "dialogue": [{"speaker": "narrator", "text": sc["narration"]}],
        }

        if sc.get("bgm"):
            scene["bgm"] = sc["bgm"]
        else:
            scene["bgm"] = "none"
        scene["bgm_gain"] = sc["bgm_gain"]
        # Start the bed where the track actually has content (see BGM_OFFSETS).
        if sc.get("bgm"):
            scene["bgm_offset"] = BGM_OFFSETS.get(sc["id"], 0)

        # `hold_silent_tail` is the engine's own switch for "this scene is longer than its
        # narration on purpose". Without it, voice_engine caps a scene at speech + 2.4 s and the
        # visual beats (walks, montage cuts, the freeze) get rescaled out of the authored timing.
        scene["hold_silent_tail"] = True
        # Frame geometry is applied here (not in the module-level SCENES table) so the same
        # story table can be emitted at either aspect ratio.
        for pr in scene["props"]:
            if pr["type"] == "wall_slab":
                pr["height"], pr["width"] = WALL_H, WALL_W
            elif pr["type"] == "wall_ripple":
                pr["height"] = WALL_H * 0.83
            elif pr["type"] == "impact_star":
                pr["height"] = WALL_H * float(pr.get("h_frac", 1.0))
                pr.pop("h_frac", None)

        if sc.get("fade_to_black"):
            scene["fade_to_black"] = True

        # --- captions (the film's TEXT beats) -------------------------------------------------
        # The caption window is derived from the narration window (lead_in -> scene end), not
        # hand-timed: a caption that appears before the line or lingers after it reads as a bug.
        lead, accent, _at, _until = sc["caption"]
        at = max(0.22, round(sc["lead_in"] - 0.18, 2))
        until = round(sc["dur"] - 0.30, 2)
        scene["props"].append(
            {
                "type": "ink_caption",
                "at": at,
                "until": until,
                "text": lead,
                "accent": accent,
                "size": sc.get("caption_size", CAPTION_SIZE),
                "x": 0.5,
                "y": sc.get("caption_y", CAPTION_Y),
            }
        )
        if sc.get("follow_caption"):
            f_lead, f_accent, f_at, f_until = sc["follow_caption"]
            f_until = until
            scene["props"].append(
                {
                    "type": "ink_caption",
                    "at": f_at,
                    "until": f_until,
                    "text": f_lead,
                    "accent": f_accent,
                    "size": 54,
                    "x": 0.5,
                    "y": 176,
                }
            )

        # --- characters ------------------------------------------------------------------------
        chars = []
        first_beats = sc.get("beats")
        if first_beats is None:
            first_beats = [{"start": 0.0, "end": sc["dur"], "action": "idle_stand", "x": 0.5, "facing": 1}]
        # --- portrait re-block ----------------------------------------------------------------
        if portrait:
            half_land = WALL_W_LAND / 1920 * 0.5
            half_port = WALL_W / 1080 * 0.5
            for pr in scene["props"]:
                if pr["type"] == "box_stack":
                    pr["x"] = remap_x(pr["x"], half_land, half_port)
            for ch in [first_beats] + ([sc["beats_second"]] if sc.get("beats_second") else []):
                for bt in ch:
                    for key in ("x", "from_x", "to_x"):
                        if key in bt:
                            bt[key] = remap_x(bt[key], half_land, half_port)

        chars.append({"id": "first", "show_name": False, "beats": first_beats})
        if sc.get("beats_second"):
            chars.append({"id": "second", "show_name": False, "beats": sc["beats_second"]})
        scene["characters"] = chars

        # The shock marks track whoever is being surprised (always `first` in this cut).
        if sc.get("shock_at") is not None:
            scene["props"].append(
                {
                    "type": "shock_marks",
                    "x": 0.545,
                    "at": sc["shock_at"],
                    "hold": 2.0,
                    "height": SHOCK_H,
                    "dx": 0,
                    "scale": 1.0,
                }
            )

        spec["scenes"].append(scene)

    return spec


def main() -> int:
    argv = sys.argv[1:]
    portrait = "--portrait" in argv
    argv = [a for a in argv if a != "--portrait"]
    out = Path(argv[0]) if argv else ROOT / "work/the_wall_you_agreed_with_episode.json"
    spec = build(portrait=portrait)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(spec, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    total = sum(s["min_duration"] for s in spec["scenes"])
    print(f"wrote {out}")
    print(f"scenes={len(spec['scenes'])}  total={total:.2f}s  ({int(total // 60)}:{total % 60:04.1f})  "
          f"{'portrait 1080x1920' if portrait else 'landscape 1920x1080'}  cast_scale={CAST_SCALE} wall={WALL_W}x{WALL_H}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
