import { Howl, Howler } from 'howler';

/**
 * AudioManager — centralised sound system.
 * Uses Howler.js for spatial audio and looping.
 * All sounds are loaded lazily on first play.
 * Free sounds should be placed in /public/sounds/
 *
 * FREE SOUND DOWNLOADS (CC0 — no attribution needed):
 *   https://freesound.org/people/qubodup/sounds/182429/  → cannon.wav
 *   https://freesound.org/people/InspectorJ/sounds/416615/ → splash.wav
 *   https://freesound.org/people/Luftrum/sounds/48441/   → ocean.mp3
 *   https://freesound.org/people/deleted_user_877451/sounds/76376/ → thunder.wav
 *   https://freesound.org/people/Robinhood76/sounds/55846/ → wood_creak.wav
 *   https://freesound.org/people/Joao_Janz/sounds/478619/ → coins.wav
 */

const SOUNDS = {
  cannon:    { src: '/sounds/cannon.wav',     volume: 0.8 },
  impact:    { src: '/sounds/impact.wav',     volume: 0.7 },
  splash:    { src: '/sounds/splash.wav',     volume: 0.5 },
  wood:      { src: '/sounds/wood_creak.wav', volume: 0.4 },
  chain:     { src: '/sounds/chain.wav',      volume: 0.6 },
  coins:     { src: '/sounds/coins.wav',      volume: 0.6 },
  thunder:   { src: '/sounds/thunder.wav',    volume: 0.3 },
  board:     { src: '/sounds/boarding.wav',   volume: 0.7 },
  whoosh:    { src: '/sounds/whoosh.wav',     volume: 0.5 },
  sabotage:  { src: '/sounds/explosion.wav', volume: 0.6 },
  victory:   { src: '/sounds/victory.wav',   volume: 0.8 },
  defeat:    { src: '/sounds/defeat.wav',    volume: 0.7 },
  ocean:     { src: '/sounds/ocean.mp3',     volume: 0.18, loop: true },
  battle:    { src: '/sounds/battle.mp3',    volume: 0.22, loop: true },
};

const cache = {};

const AudioManager = {
  _masterVol: 1,
  _bgm: null,

  _get(key) {
    if (!cache[key]) {
      const cfg = SOUNDS[key];
      if (!cfg) return null;
      cache[key] = new Howl({
        src: [cfg.src],
        volume: cfg.volume ?? 0.5,
        loop: cfg.loop ?? false,
      });
    }
    return cache[key];
  },

  play(key) {
    try { this._get(key)?.play(); } catch {}
  },

  startOcean() {
    const s = this._get('ocean');
    if (s && !s.playing()) s.play();
  },

  startBattle() {
    this.stopBGM();
    this._bgm = this._get('battle');
    if (this._bgm && !this._bgm.playing()) this._bgm.play();
  },

  stopBGM() {
    if (this._bgm?.playing()) this._bgm.stop();
    this._bgm = null;
  },

  stopAll() {
    Object.values(cache).forEach(h => { try { h.stop(); } catch {} });
  },

  setVolume(v) {
    this._masterVol = v;
    Howler.volume(v);
  },
};

export default AudioManager;
