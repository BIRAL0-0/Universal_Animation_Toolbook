"""Behavioural contracts for the KI-020 shared secondary-motion layer."""
from __future__ import annotations

import json
import subprocess

import pytest

ROOT = __import__("pathlib").Path(__file__).resolve().parents[2]


@pytest.fixture(scope="module")
def motion_probe():
    script = r"""
const { evaluateCharacterState } = require('./universal_toolbook/engine/motion_library.js');
const actor = (beats, extra={}) => ({id:'mira', scale:1.0, beats, ...extra});
function at(a, t) { return evaluateCharacterState(a, t, 8, t, 1920, 855, null); }
function vals(s) { return [s.pose.lean,s.pose.head,s.pose.spineCurve,...s.pose.al,...s.pose.ar,s.lookX,s.lookY]; }
function delta(a,b) { return Math.max(...vals(a).map((v,i)=>Math.abs(v-vals(b)[i]))); }
const baseBeat = {start:0,end:8,action:'idle_stand',x:.5,facing:1};
const full = at(actor([{...baseBeat,secondary_motion:'full'}]),3);
const repeat = at(actor([{...baseBeat,secondary_motion:'full'}]),3);
const subtle = at(actor([{...baseBeat,secondary_motion:'subtle'}]),3);
const none = at(actor([{...baseBeat,secondary_motion:'none'}]),3);
const defaultMode = at(actor([baseBeat]),3);
const unknownMode = at(actor([{...baseBeat,secondary_motion:'typo'}]),3);
const actorDefault = at(actor([{start:0,end:8,action:'idle_stand',x:.5,facing:1}],{secondary_motion:'none'}),3);
const beatOverride = at(actor([{...baseBeat,secondary_motion:'full'}],{secondary_motion:'none'}),3);
const walkFull = at(actor([{...baseBeat,action:'walk',secondary_motion:'full'}]),3);
const walkNone = at(actor([{...baseBeat,action:'walk',secondary_motion:'none'}]),3);
const stationaryThenWalk = actor([
  {start:0,end:4,action:'idle_stand',x:.5,facing:1},
  {start:4,end:8,action:'walk',x:.5,facing:1},
]);
const stationaryHandoff = [
  {start:0,end:4,action:'idle_stand',x:.5,facing:1},
  {start:4,end:8,action:'listen_nod',x:.5,facing:1},
];
const blendFull = at(actor(stationaryHandoff),4.12);
const blendNone = at(actor(stationaryHandoff.map(b=>({...b,secondary_motion:'none'}))),4.12);
const beforeCut = at(stationaryThenWalk,4-1/30);
const atCut = at(stationaryThenWalk,4);
const oneFrameSteady = delta(at(actor([{...baseBeat,secondary_motion:'full'}]),2),
                             at(actor([{...baseBeat,secondary_motion:'full'}]),2+1/30));
console.log(JSON.stringify({
 deterministic: delta(full,repeat),
 fullSubtle: delta(full,none), subtleNone: delta(subtle,none), defaultFull: delta(defaultMode,full),
 unknownFallsBack: delta(unknownMode,defaultMode),
 noneBaseLean: none.pose.lean, actorNoneVsDefault: delta(actorDefault,defaultMode),
 beatOverridesActor: delta(beatOverride,full), walkFullVsNone: delta(walkFull,walkNone),
 cutDelta: delta(beforeCut,atCut), oneFrameSteady,
 blendFullVsNone: delta(blendFull,blendNone),
 transitionFullVsNone: delta(at(stationaryThenWalk,3.9), at(actor([
  {start:0,end:4,action:'idle_stand',x:.5,facing:1,secondary_motion:'none'},
  {start:4,end:8,action:'walk',x:.5,facing:1,secondary_motion:'none'}]),3.9))
}));
"""
    proc = subprocess.run(
        ["node", "-e", script], cwd=ROOT, text=True, capture_output=True, check=True
    )
    return json.loads(proc.stdout.strip().splitlines()[-1])


def test_secondary_motion_is_deterministic_and_default_full(motion_probe):
    assert motion_probe["deterministic"] == 0
    assert motion_probe["defaultFull"] == 0
    assert motion_probe["unknownFallsBack"] == 0


def test_stillness_modes_scale_the_layer_and_none_preserves_base_pose(motion_probe):
    assert motion_probe["noneBaseLean"] == pytest.approx(0.022, abs=0.05)
    assert motion_probe["subtleNone"] > 0
    assert motion_probe["fullSubtle"] > motion_probe["subtleNone"]


def test_actor_default_and_beat_override_are_backwards_compatible(motion_probe):
    assert motion_probe["actorNoneVsDefault"] > 0
    assert motion_probe["beatOverridesActor"] == 0


def test_moving_action_is_not_modified_by_secondary_motion_setting(motion_probe):
    assert motion_probe["walkFullVsNone"] == 0


def test_secondary_layer_runs_on_blend_and_fades_through_moving_transition(motion_probe):
    assert motion_probe["blendFullVsNone"] > 0
    assert motion_probe["transitionFullVsNone"] > 0
    assert motion_probe["cutDelta"] < motion_probe["oneFrameSteady"] * 8 + 0.05
