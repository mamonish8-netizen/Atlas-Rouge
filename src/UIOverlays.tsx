import React, { useState } from 'react';
import {
  Axe,
  Backpack,
  Check,
  Copy,
  Crosshair,
  Flame,
  HeartPulse,
  Mic,
  MicOff,
  Pause,
  Pickaxe,
  Play,
  Settings,
  Shield,
  Users,
  Volume2,
  Wrench,
} from 'lucide-react';
import {
  CLONE_ARCHETYPES,
  CloneArchetypeId,
  CRAFTING_RECIPES,
  GraphicsQuality,
  HudSnapshot,
  PartyMember,
  ToolSlotId,
} from './types';

interface LoadingScreenProps {
  statusLabel: string;
  progress: number;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ statusLabel, progress }) => {
  const pct = Math.round(Math.min(100, Math.max(0, progress * 100)));
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 text-slate-100 px-6">
      <div className="w-full max-w-xl">
        <div className="text-xs font-medium tracking-widest text-cyan-400 mb-3">
          ORBITAL BIOSPHERE SECTOR 09 · BOOT SEQUENCE
        </div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-6 font-display">
          Atlas Rouge
        </h1>

        <div className="bg-slate-900/95 border border-white/10 rounded-xl p-6 space-y-5">
          <div className="space-y-2 text-sm text-slate-300 font-mono-nums">
            <div className={pct >= 15 ? 'text-cyan-300' : 'text-slate-500'}>
              01. INITIALIZING CLONE PODS
            </div>
            <div className={pct >= 50 ? 'text-cyan-300' : 'text-slate-500'}>
              02. COMPILING SHADERS &amp; TERRAIN MAPS
            </div>
            <div className={pct >= 85 ? 'text-cyan-300' : 'text-slate-500'}>
              03. LINKING TO ATLAS NETWORK
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="truncate">{statusLabel}</span>
              <span className="font-mono-nums text-cyan-300 font-semibold">{pct}%</span>
            </div>
            <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-cyan-500 transition-all duration-150"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface LobbyScreenProps {
  playerName: string;
  setPlayerName: (name: string) => void;
  archetype: CloneArchetypeId;
  setArchetype: (a: CloneArchetypeId) => void;
  quality: GraphicsQuality;
  setQuality: (q: GraphicsQuality) => void;
  partyMembers: PartyMember[];
  localId: string;
  isHost: boolean;
  isSolo: boolean;
  inviteCode: string;
  connectionStatus: string;
  errorMessage: string | null;
  micLevel: number;
  isMuted: boolean;
  micEnabled: boolean;
  onEnableMic: () => void;
  onToggleMute: () => void;
  onHostParty: () => void;
  onJoinParty: (code: string) => void;
  onSoloRun: () => void;
  onToggleReady: () => void;
  onLaunchGame: () => void;
}

const QUALITY_SCALE_HINT: Record<GraphicsQuality, string> = {
  low: '0.55x Res',
  medium: '0.85x Res',
  high: '1.35x+ Res',
  ultra: '2.50x Max Res',
};

export const LobbyScreen: React.FC<LobbyScreenProps> = ({
  playerName,
  setPlayerName,
  archetype,
  setArchetype,
  quality,
  setQuality,
  partyMembers,
  localId,
  isHost,
  isSolo,
  inviteCode,
  connectionStatus,
  errorMessage,
  micLevel,
  isMuted,
  micEnabled,
  onEnableMic,
  onToggleMute,
  onHostParty,
  onJoinParty,
  onSoloRun,
  onToggleReady,
  onLaunchGame,
}) => {
  const [joinInput, setJoinInput] = useState('');
  const [copied, setCopied] = useState(false);

  const localMember = partyMembers.find((m) => m.id === localId);
  const allReady = partyMembers.length > 0 && partyMembers.every((m) => m.ready || m.isHost);

  const handleCopyCode = () => {
    if (!inviteCode) return;
    void navigator.clipboard?.writeText(inviteCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-950/92 text-slate-100 p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white font-display">
              Atlas Rouge
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Orbital Co-Op Survival &amp; Boss-Rush · 1 to 4 Clones
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs text-slate-400">Graphics Quality</div>
              <div className="text-[11px] font-mono-nums text-cyan-300">
                {QUALITY_SCALE_HINT[quality]}
              </div>
            </div>
            <div className="flex items-center gap-1 bg-slate-900 border border-white/10 p-1 rounded-lg">
              {(['low', 'medium', 'high', 'ultra'] as GraphicsQuality[]).map((q) => (
                <button
                  key={q}
                  onClick={() => setQuality(q)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors whitespace-nowrap shrink-0 ${
                    quality === q
                      ? 'bg-cyan-500 text-slate-950 font-semibold'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 bg-slate-900/90 border border-white/10 rounded-xl p-6 space-y-6">
            <div className="space-y-2">
              <label htmlFor="clone-name" className="block text-sm font-semibold text-slate-200">
                Clone Designation (Custom Name)
              </label>
              <input
                id="clone-name"
                type="text"
                maxLength={18}
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter clone name..."
                className="w-full bg-slate-950 border border-white/15 rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-white">Select Clone Class</h2>
                <span className="text-xs text-slate-400">5 Categories</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(Object.keys(CLONE_ARCHETYPES) as CloneArchetypeId[]).map((id) => {
                  const arch = CLONE_ARCHETYPES[id];
                  const selected = archetype === id;
                  return (
                    <button
                      key={id}
                      onClick={() => setArchetype(id)}
                      className={`text-left p-4 rounded-xl border transition-colors ${
                        selected
                          ? 'bg-slate-800 border-cyan-400'
                          : 'bg-slate-950/70 border-white/10 hover:border-white/25'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="w-3.5 h-3.5 rounded-sm shrink-0 border border-white/20"
                            style={{ backgroundColor: arch.primaryHex }}
                          />
                          <span className="font-semibold text-white text-sm">{arch.name}</span>
                        </div>
                        <span className="text-xs font-mono-nums text-slate-400">{arch.code}</span>
                      </div>
                      <div className="text-xs text-slate-400 mb-1.5">{arch.role}</div>
                      <div className="text-xs font-medium text-cyan-300">{arch.passiveLabel}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={micEnabled ? onToggleMute : onEnableMic}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    !micEnabled
                      ? 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                      : isMuted
                        ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  }`}
                >
                  {isMuted || !micEnabled ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  <span>
                    {!micEnabled ? 'Enable Proximity Mic' : isMuted ? 'Mic Muted (M)' : 'Mic Active (M)'}
                  </span>
                </button>

                <div className="w-28 h-2 bg-slate-800 rounded-full overflow-hidden" title="Microphone test meter">
                  <div
                    className="h-full bg-emerald-400 transition-all duration-75"
                    style={{ width: `${Math.round(micLevel * 100)}%` }}
                  />
                </div>
              </div>

              <span className="text-xs text-slate-400">
                Spatial voice active within 35m radius
              </span>
            </div>
          </div>

          <div className="lg:col-span-5 bg-slate-900/90 border border-white/10 rounded-xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-cyan-400" />
                <span>Co-Op Drop Squad ({partyMembers.length}/4)</span>
              </h2>
              <span className="text-xs text-slate-400">
                {isSolo ? 'Solo Mode' : isHost ? 'Hosting Co-Op' : 'Joined Co-Op'}
              </span>
            </div>

            <div className="space-y-3 bg-slate-950/70 border border-white/10 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={onSoloRun}
                  className={`px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                    isSolo
                      ? 'bg-cyan-500 text-slate-950'
                      : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  Solo Mode
                </button>
                <button
                  onClick={onHostParty}
                  className={`px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                    !isSolo && isHost
                      ? 'bg-cyan-500 text-slate-950'
                      : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  Host Co-Op Mode
                </button>
              </div>

              {inviteCode && (
                <div className="flex items-center justify-between bg-slate-900 border border-cyan-500/30 rounded-lg px-3 py-2">
                  <div>
                    <div className="text-[11px] text-slate-400">Co-Op Party Invite Code</div>
                    <div className="text-lg font-bold tracking-widest text-cyan-300 font-mono-nums">
                      {inviteCode}
                    </div>
                  </div>
                  <button
                    onClick={handleCopyCode}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white rounded-md transition-colors whitespace-nowrap shrink-0"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy Code'}</span>
                  </button>
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  maxLength={6}
                  value={joinInput}
                  onChange={(e) => setJoinInput(e.target.value.toUpperCase())}
                  placeholder="ENTER 6-CHAR CODE"
                  className="flex-1 bg-slate-900 border border-white/15 rounded-lg px-3 py-2 text-xs font-mono-nums tracking-widest text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
                <button
                  onClick={() => onJoinParty(joinInput)}
                  disabled={joinInput.trim().length !== 6 || connectionStatus === 'connecting'}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs font-semibold text-white rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  {connectionStatus === 'connecting' ? 'Joining...' : 'Join Co-Op'}
                </button>
              </div>

              {errorMessage && (
                <div className="text-xs text-red-400 bg-red-950/40 border border-red-500/30 rounded-md px-3 py-2">
                  {errorMessage}
                </div>
              )}
            </div>

            <div className="space-y-2">
              {[0, 1, 2, 3].map((slotIdx) => {
                const member = partyMembers[slotIdx];
                if (!member) {
                  return (
                    <div
                      key={slotIdx}
                      className="flex items-center justify-between px-4 py-2.5 rounded-lg border border-dashed border-white/10 text-xs text-slate-500"
                    >
                      <span>Drop Pod Slot {slotIdx + 1}</span>
                      <span>Empty</span>
                    </div>
                  );
                }
                const arch = CLONE_ARCHETYPES[member.archetype];
                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-slate-950/80 border border-white/10"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className="w-3 h-7 rounded-sm shrink-0"
                        style={{ backgroundColor: arch.primaryHex }}
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white truncate">
                          {member.name} {member.id === localId ? '(You)' : ''}
                        </div>
                        <div className="text-xs text-slate-400">
                          {arch.name} · {member.isHost ? 'Host' : 'Squad'}
                        </div>
                      </div>
                    </div>

                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-md ${
                        member.ready || member.isHost
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {member.isHost ? 'Host Ready' : member.ready ? 'Ready' : 'Not Ready'}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 flex flex-col gap-2">
              {!isHost && (
                <button
                  onClick={onToggleReady}
                  className={`w-full py-3 rounded-xl text-sm font-bold transition-colors ${
                    localMember?.ready
                      ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                      : 'bg-slate-800 text-white hover:bg-slate-700'
                  }`}
                >
                  {localMember?.ready ? 'Ready (Click to Cancel)' : 'Mark Ready'}
                </button>
              )}

              {isHost && (
                <button
                  onClick={onLaunchGame}
                  disabled={!allReady}
                  className="w-full py-3.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-slate-950 font-bold text-sm tracking-wide transition-colors flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>{isSolo ? 'Launch Solo Drop Pod' : 'Launch Co-Op Drop Pod'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface GameHudProps {
  hud: HudSnapshot;
  partyMembers: PartyMember[];
  localId: string;
  localArchetype: CloneArchetypeId;
  isMuted: boolean;
  craftingOpen: boolean;
  pauseOpen: boolean;
  noticeText: string | null;
  quality: GraphicsQuality;
  volumes: { master: number; sfx: number; voice: number };
  onOpenCrafting: () => void;
  onCloseCrafting: () => void;
  onCraft: (id: string) => void;
  onSmeltMetal: () => void;
  onUpgradeGear: (kind: 'pickaxe' | 'hatchet' | 'armor') => void;
  onSelectSlot: (slot: ToolSlotId) => void;
  onResume: () => void;
  onChangeQuality: (q: GraphicsQuality) => void;
  onChangeVolumes: (master: number, sfx: number, voice: number) => void;
  onToggleMute: () => void;
  onExitToLobby: () => void;
  onRequestPointerLock: () => void;
}

export const GameHud: React.FC<GameHudProps> = ({
  hud,
  partyMembers,
  localId,
  localArchetype,
  isMuted,
  craftingOpen,
  pauseOpen,
  noticeText,
  quality,
  volumes,
  onOpenCrafting,
  onCloseCrafting,
  onCraft,
  onSmeltMetal,
  onUpgradeGear,
  onSelectSlot,
  onResume,
  onChangeQuality,
  onChangeVolumes,
  onToggleMute,
  onExitToLobby,
  onRequestPointerLock,
}) => {
  const repairedCount = hud.beacons.filter((b) => b.repaired).length;
  const totalBeacons = hud.beacons.length || 6;
  const hpPct = Math.max(0, Math.min(100, (hud.hp / hud.maxHp) * 100));
  const stamPct = Math.max(0, Math.min(100, (hud.stamina / hud.maxStamina) * 100));
  const archInfo = CLONE_ARCHETYPES[localArchetype];
  const isApexPhase =
    hud.phase === 'elevator_cutscene' ||
    hud.phase === 'boss_wake' ||
    hud.phase === 'boss_fight' ||
    hud.phase === 'victory';

  return (
    <div className="fixed inset-0 z-20 pointer-events-none select-none">
      {hud.damageFlash > 0.02 && (
        <div
          className="fixed inset-0 pointer-events-none border-[18px] border-red-600/70"
          style={{ opacity: hud.damageFlash * 0.75 }}
        />
      )}

      {/* Floating 3D-Projected Teammate Nameplates */}
      {hud.projectedLabels.map((lbl) => {
        if (!lbl.visible) return null;
        const arch = CLONE_ARCHETYPES[lbl.archetype];
        return (
          <div
            key={lbl.id}
            className="fixed -translate-x-1/2 -translate-y-full pointer-events-none"
            style={{ left: `${lbl.screenX}px`, top: `${lbl.screenY}px` }}
          >
            <div className="flex flex-col items-center gap-0.5">
              {lbl.isSpeaking && (
                <div className="bg-emerald-500/90 text-slate-950 rounded-full p-1">
                  <Volume2 className="w-3.5 h-3.5" />
                </div>
              )}
              <div className="bg-slate-950/85 border border-white/15 px-2 py-0.5 rounded text-[11px] font-semibold text-white whitespace-nowrap flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-xs" style={{ backgroundColor: arch.primaryHex }} />
                <span>{lbl.name}</span>
                <span className="text-slate-400 font-mono-nums">{Math.round(lbl.distance)}m</span>
              </div>
              <div className="w-16 h-1 bg-slate-900 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-400"
                  style={{ width: `${Math.max(0, Math.min(100, (lbl.hp / lbl.maxHp) * 100))}%` }}
                />
              </div>
            </div>
          </div>
        );
      })}

      {/* Floating Small Health Bars Above Enemies */}
      {hud.enemyLabels.map((el) => {
        if (!el.visible) return null;
        const pct = Math.max(0, Math.min(100, (el.hp / el.maxHp) * 100));
        return (
          <div
            key={el.id}
            className="fixed -translate-x-1/2 -translate-y-full pointer-events-none"
            style={{ left: `${el.screenX}px`, top: `${el.screenY}px` }}
          >
            <div className="flex flex-col items-center gap-0.5">
              <div className="bg-slate-950/85 px-1.5 py-0.5 rounded text-[10px] font-semibold text-amber-200 whitespace-nowrap border border-white/10">
                {el.name} · <span className="font-mono-nums">{Math.ceil(el.hp)}</span>
              </div>
              <div className="w-20 h-1.5 bg-slate-900 rounded-full overflow-hidden border border-white/15">
                <div
                  className="h-full bg-red-500 transition-all duration-75"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </div>
        );
      })}

      {/* TOP-LEFT: Consolidated Interactive Hotbar + Party Frames */}
      <div className="fixed top-4 left-4 space-y-2.5 max-w-[340px]">
        {/* Interactive Top-Left Hotbar */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-950/92 border border-white/15 rounded-xl p-1.5 pointer-events-auto">
          <button
            onClick={() => onSelectSlot('pickaxe')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              hud.activeSlot === 'pickaxe'
                ? 'bg-cyan-500 text-slate-950'
                : 'bg-slate-900 text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Pickaxe className="w-3.5 h-3.5" />
            <span>[1] T{hud.inventory.pickaxeTier}</span>
          </button>

          <button
            onClick={() => onSelectSlot('hatchet')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              !hud.inventory.hasHatchet
                ? 'bg-slate-900/60 text-slate-500 border border-dashed border-white/10'
                : hud.activeSlot === 'hatchet'
                  ? 'bg-cyan-500 text-slate-950'
                  : 'bg-slate-900 text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Axe className="w-3.5 h-3.5" />
            <span>
              [2] {hud.inventory.hasHatchet ? `T${hud.inventory.hatchetTier}` : 'Craft'}
            </span>
          </button>

          <button
            onClick={() => onSelectSlot('bow')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              !hud.inventory.hasBow
                ? 'bg-slate-900/60 text-slate-500 border border-dashed border-white/10'
                : hud.activeSlot === 'bow'
                  ? 'bg-cyan-500 text-slate-950'
                  : 'bg-slate-900 text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            <span className="font-mono-nums">
              [3] {hud.inventory.hasBow ? `Bow (${hud.inventory.arrows})` : 'Craft'}
            </span>
          </button>

          <button
            onClick={() => onSelectSlot('stim')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 text-emerald-300 hover:bg-slate-800 transition-colors"
          >
            <HeartPulse className="w-3.5 h-3.5" />
            <span className="font-mono-nums">[4] ({hud.inventory.stims})</span>
          </button>

          <button
            onClick={onOpenCrafting}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-amber-200 hover:bg-slate-700 transition-colors"
          >
            <Backpack className="w-3.5 h-3.5" />
            <span>[V] Bag</span>
          </button>
        </div>

        {/* Squad Frames */}
        <div className="space-y-1.5 w-60">
          {partyMembers.map((m) => {
            const arch = CLONE_ARCHETYPES[m.archetype];
            const pct = Math.max(0, Math.min(100, (m.hp / m.maxHp) * 100));
            const speaking = m.id === localId ? false : m.isSpeaking;
            return (
              <div
                key={m.id}
                className="bg-slate-950/85 border border-white/10 rounded-lg px-3 py-1.5"
              >
                <div className="flex items-center justify-between text-xs mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-xs shrink-0"
                      style={{ backgroundColor: arch.primaryHex }}
                    />
                    <span className="font-semibold text-white truncate">{m.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {speaking && <Volume2 className="w-3.5 h-3.5 text-emerald-400" />}
                    {m.isMuted && <MicOff className="w-3 h-3 text-red-400" />}
                    <span className="font-mono-nums text-slate-300">{Math.ceil(m.hp)}</span>
                  </div>
                </div>
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-100"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* TOP-CENTER: Objective Tracker OR 7-Stage ATLAS Boss Health Bar & Cutscenes */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 w-full max-w-xl px-4">
        {hud.boss.active ? (
          <div className="bg-slate-950/92 border border-red-500/40 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-red-400 font-display tracking-wider">{hud.boss.name}</span>
              <span className="font-mono-nums text-slate-200">
                Stage {hud.boss.stage}/{hud.boss.maxStages} · {hud.boss.hp} / {hud.boss.maxHp}
                {hud.boss.immune
                  ? ' · PHASE SHIELD IMMUNE'
                  : hud.boss.resting
                    ? ' · DESCENDED (MELEE WINDOW)'
                    : ''}
              </span>
            </div>
            <div className="relative h-3.5 w-full bg-slate-900 rounded-full overflow-hidden border border-white/10">
              <div
                className={`h-full transition-all duration-100 ${
                  hud.boss.immune
                    ? 'bg-amber-400'
                    : hud.boss.resting
                      ? 'bg-cyan-400'
                      : 'bg-red-500'
                }`}
                style={{ width: `${(hud.boss.hp / hud.boss.maxHp) * 100}%` }}
              />
              {[1, 2, 3, 4, 5, 6].map((seg) => (
                <div
                  key={seg}
                  className="absolute top-0 bottom-0 w-0.5 bg-slate-950/90"
                  style={{ left: `${(seg / 7) * 100}%` }}
                />
              ))}
            </div>
            {hud.boss.subtitle && (
              <div className="text-xs text-amber-200 text-center font-medium pt-0.5">
                {hud.boss.subtitle}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-slate-950/88 border border-white/10 rounded-xl px-4 py-2.5 text-center">
            {hud.phase === 'jungle' && (
              <div className="text-xs font-semibold text-cyan-300">
                PHASE 1 · REPAIR {totalBeacons} BEACONS ({repairedCount}/{totalBeacons} ONLINE · 2 ON SKY-PLATFORMS)
              </div>
            )}
            {hud.phase === 'elevator_ready' && (
              <div className="text-xs font-semibold text-emerald-300">
                PHASE 2 · CENTRAL SPIRE BLAST DOORS OPEN · ENTER GLASS ELEVATOR AT CENTER
              </div>
            )}
            {hud.phase === 'elevator_cutscene' && (
              <div className="space-y-1">
                <div className="text-[11px] uppercase tracking-wider text-cyan-300 font-semibold">
                  Ascending to Apex Command Deck · Free 360° Camera Orbit Active
                </div>
                {hud.cutsceneLine && (
                  <div className="text-sm font-medium text-amber-200">{hud.cutsceneLine}</div>
                )}
              </div>
            )}
            {hud.phase === 'boss_wake' && (
              <div className="space-y-1">
                <div className="text-[11px] uppercase tracking-wider text-red-400 font-bold">
                  ALERT · ATLAS OVERMIND AWAKENING
                </div>
                {hud.cutsceneLine && (
                  <div className="text-sm font-semibold text-red-200">{hud.cutsceneLine}</div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* TOP-RIGHT: Biosphere Radar Minimap (scaled for 215m radius) */}
      <div className="fixed top-4 right-4 bg-slate-950/90 border border-white/15 rounded-xl p-2.5 w-44 space-y-1.5">
        <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
          <span>Biosphere Radar</span>
          <span className="font-mono-nums text-cyan-400">
            {repairedCount}/{totalBeacons}
          </span>
        </div>
        <div className="relative w-38 h-38 mx-auto rounded-full bg-slate-900 border border-cyan-500/25 overflow-hidden">
          <div
            className="absolute w-3.5 h-3.5 rounded-full bg-slate-400 border border-white/50 -translate-x-1/2 -translate-y-1/2"
            style={{ left: '50%', top: '50%' }}
            title="Central Spire"
          />
          {/* Forging Station Amber Marker on East Edge */}
          <div
            className="absolute w-3 h-3 rounded-xs bg-amber-500 border border-white -translate-x-1/2 -translate-y-1/2 flex items-center justify-center text-[8px] font-bold text-slate-950"
            style={{
              left: `${50 + (hud.minimapEntities.forgeX / 215) * 45}%`,
              top: `${50 + (hud.minimapEntities.forgeZ / 215) * 45}%`,
            }}
            title="Forging Station"
          >
            F
          </div>

          {hud.minimapEntities.beacons.map((b) => {
            const mx = 50 + (b.x / 215) * 45;
            const mz = 50 + (b.z / 215) * 45;
            return (
              <div
                key={b.id}
                className={`absolute w-2.5 h-2.5 rounded-full -translate-x-1/2 -translate-y-1/2 ${
                  b.repaired
                    ? 'bg-emerald-400'
                    : b.isFloating
                      ? 'bg-sky-300 ring-2 ring-amber-400'
                      : 'bg-cyan-400 ring-2 ring-cyan-300/60'
                }`}
                style={{ left: `${mx}%`, top: `${mz}%` }}
              />
            );
          })}
          {hud.minimapEntities.enemies.map((e, idx) => {
            const mx = 50 + (e.x / 215) * 45;
            const mz = 50 + (e.z / 215) * 45;
            if (mx < 2 || mx > 98 || mz < 2 || mz > 98) return null;
            return (
              <div
                key={idx}
                className={`absolute w-1.5 h-1.5 rounded-full -translate-x-1/2 -translate-y-1/2 ${
                  e.isFlying ? 'bg-teal-300' : 'bg-red-500'
                }`}
                style={{ left: `${mx}%`, top: `${mz}%` }}
              />
            );
          })}
          {hud.minimapEntities.teammates.map((t) => {
            const mx = 50 + (t.x / 215) * 45;
            const mz = 50 + (t.z / 215) * 45;
            return (
              <div
                key={t.id}
                className="absolute w-2 h-2 rounded-full border border-white -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${mx}%`, top: `${mz}%`, backgroundColor: t.color }}
              />
            );
          })}
          <div
            className="absolute w-2.5 h-2.5 bg-white rounded-full border border-slate-950 -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${50 + (hud.minimapEntities.playerX / 215) * 45}%`,
              top: `${50 + (hud.minimapEntities.playerZ / 215) * 45}%`,
            }}
          />
        </div>
        <div className="text-[10px] text-center font-mono-nums text-slate-400">
          {hud.renderResolutionLabel}
        </div>
      </div>

      {/* CENTER: Crosshair, Pointer Lock Prompt, Slow Warning, Interaction Prompt */}
      {hud.phase !== 'victory' && hud.phase !== 'defeat' && hud.phase !== 'elevator_cutscene' && hud.phase !== 'boss_wake' && (
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none">
          <div className="relative flex items-center justify-center">
            <Crosshair
              className={`transition-transform duration-75 ${
                hud.isAiming ? 'w-7 h-7 text-cyan-300 scale-90' : 'w-5 h-5 text-white/75'
              }`}
            />
            {hud.bowCharge > 0.05 && (
              <div className="absolute top-8 w-16 h-1.5 bg-slate-900 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-400"
                  style={{ width: `${Math.round(hud.bowCharge * 100)}%` }}
                />
              </div>
            )}
            {hud.hitMarker > 0.1 && (
              <div className="absolute w-6 h-6 border-2 border-amber-400 rotate-45 opacity-90" />
            )}
          </div>
        </div>
      )}

      {!hud.pointerLocked && !craftingOpen && !pauseOpen && hud.phase !== 'victory' && hud.phase !== 'defeat' && (
        <div className="fixed top-28 left-1/2 -translate-x-1/2 pointer-events-auto">
          <button
            onClick={onRequestPointerLock}
            className="px-4 py-2 bg-slate-900/95 hover:bg-slate-800 border border-cyan-400/50 rounded-lg text-xs font-semibold text-cyan-200 transition-colors"
          >
            Click Viewport for 360° Look (or Drag / Arrow Keys)
          </button>
        </div>
      )}

      {hud.isSlowed && (
        <div className="fixed top-40 left-1/2 -translate-x-1/2 bg-purple-950/90 border border-purple-400/50 rounded-lg px-3.5 py-1.5 text-xs font-bold text-purple-200">
          GRAVITY / MIRE HAZARD · MOVEMENT SPEED -45%
        </div>
      )}

      {noticeText && (
        <div className="fixed top-48 left-1/2 -translate-x-1/2 bg-amber-950/90 border border-amber-400/40 rounded-lg px-4 py-2 text-xs font-semibold text-amber-200">
          {noticeText}
        </div>
      )}

      {!isApexPhase && hud.interactPrompt && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-slate-950/92 border border-cyan-400/40 rounded-lg px-4 py-2.5 max-w-md text-center space-y-1.5">
          <div className="text-xs font-semibold text-white">{hud.interactPrompt}</div>
          {hud.interactProgress > 0 && (
            <div className="w-64 mx-auto h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-cyan-400 transition-all duration-75"
                style={{ width: `${Math.round(hud.interactProgress * 100)}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* BOTTOM-LEFT: Player Integrity, Stamina, & Compact Controls (only show jungle resources when in jungle) */}
      {hud.phase !== 'elevator_cutscene' && hud.phase !== 'boss_wake' && (
        <div className="fixed bottom-4 left-4 bg-slate-950/88 border border-white/10 rounded-xl p-3.5 w-72 space-y-2.5">
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-200">Integrity (HP)</span>
              <span className="font-mono-nums text-emerald-300 font-semibold">
                {hud.hp} / {hud.maxHp}
              </span>
            </div>
            <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 transition-all duration-100" style={{ width: `${hpPct}%` }} />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300">
                Stamina {hud.isSprinting ? '· SPRINTING' : '(Shift Sprint · C Dodge)'}
              </span>
              <span className="font-mono-nums text-amber-300">{hud.stamina}</span>
            </div>
            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-75 ${
                  hud.isSprinting ? 'bg-cyan-400' : 'bg-amber-400'
                }`}
                style={{ width: `${stamPct}%` }}
              />
            </div>
          </div>

          {!isApexPhase && (
            <div className="pt-1 border-t border-white/10 grid grid-cols-4 gap-1 text-[11px] text-slate-300 font-mono-nums">
              <span>W:{hud.inventory.wood}</span>
              <span>R:{hud.inventory.stone}</span>
              <span>F:{hud.inventory.fiber}</span>
              <span className="text-amber-300">M:{hud.inventory.metal}</span>
            </div>
          )}

          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-amber-400" />
              {hud.inventory.hasArmor ? `Armor Tier ${hud.inventory.armorTier}` : 'No Armor Crafted'}
            </span>
            <span className="flex items-center gap-1">
              {isMuted ? <MicOff className="w-3.5 h-3.5 text-red-400" /> : <Mic className="w-3.5 h-3.5 text-emerald-400" />}
              {isMuted ? 'Muted (M)' : 'Voice (M)'}
            </span>
          </div>
        </div>
      )}

      {/* BOTTOM-CENTER: Minimal Controls Strip (hotbar consolidated to top-left) */}
      {hud.phase !== 'victory' && hud.phase !== 'defeat' && (
        <div className="fixed bottom-3 left-1/2 -translate-x-1/2 bg-slate-950/82 border border-white/10 rounded-lg px-3.5 py-1 text-[11px] text-slate-400 whitespace-nowrap">
          WASD Move · Shift Sprint · C Dodge · 1-4 Tools · LMB Attack · RMB Aim · E Interact/Climb · V Inventory/Forge · Esc Pause
        </div>
      )}

      {/* INVENTORY, CRAFTING & FORGING STATION MODAL (V) */}
      {craftingOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/84 pointer-events-auto p-6">
          <div className="w-full max-w-5xl bg-slate-900 border border-white/15 rounded-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <Backpack className="w-5 h-5 text-cyan-400" />
                <h2 className="text-xl font-bold text-white font-display">
                  Clone Inventory, Crafting &amp; Forging Station
                </h2>
              </div>
              <button
                onClick={onCloseCrafting}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white rounded-md"
              >
                Close (V)
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
              {/* Left Side: Inventory Bag & Equipped Gear */}
              <div className="md:col-span-4 space-y-4 bg-slate-950/80 border border-white/10 rounded-xl p-4">
                <div>
                  <div className="text-xs font-semibold text-slate-400 mb-1.5">Clone Class</div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <span
                      className="w-3 h-3 rounded-xs"
                      style={{ backgroundColor: archInfo.primaryHex }}
                    />
                    <span>{archInfo.name}</span>
                  </div>
                  <div className="text-xs text-cyan-300 mt-1">{archInfo.passiveLabel}</div>
                </div>

                <div className="border-t border-white/10 pt-3 space-y-1.5">
                  <div className="text-xs font-semibold text-slate-400">Stored Resources</div>
                  <div className="flex justify-between text-xs font-mono-nums text-slate-200 bg-slate-900 px-3 py-1.5 rounded-lg">
                    <span>Wood (Trees)</span>
                    <span className="font-bold text-amber-300">{hud.inventory.wood}</span>
                  </div>
                  <div className="flex justify-between text-xs font-mono-nums text-slate-200 bg-slate-900 px-3 py-1.5 rounded-lg">
                    <span>Rocks (Stone)</span>
                    <span className="font-bold text-cyan-300">{hud.inventory.stone}</span>
                  </div>
                  <div className="flex justify-between text-xs font-mono-nums text-slate-200 bg-slate-900 px-3 py-1.5 rounded-lg">
                    <span>Fiber (Round Shrubs)</span>
                    <span className="font-bold text-emerald-300">{hud.inventory.fiber}</span>
                  </div>
                  <div className="flex justify-between text-xs font-mono-nums text-slate-200 bg-slate-900 px-3 py-1.5 rounded-lg">
                    <span>Metal Scrap (Alien Ruins)</span>
                    <span className="font-bold text-orange-300">{hud.inventory.metal}</span>
                  </div>
                  <div className="flex justify-between text-xs font-mono-nums text-slate-200 bg-slate-900 px-3 py-1.5 rounded-lg">
                    <span>Refined Alloy (Smelted)</span>
                    <span className="font-bold text-yellow-300">{hud.inventory.refinedAlloy}</span>
                  </div>
                </div>

                <div className="border-t border-white/10 pt-3 space-y-1 text-xs">
                  <div className="font-semibold text-slate-400 mb-1">Gear Tiers</div>
                  <div className="flex justify-between text-slate-200">
                    <span>Pickaxe</span>
                    <span className="font-mono-nums text-cyan-300">Tier {hud.inventory.pickaxeTier}/3</span>
                  </div>
                  <div className="flex justify-between text-slate-200">
                    <span>Hatchet</span>
                    <span className="font-mono-nums text-cyan-300">
                      {hud.inventory.hasHatchet ? `Tier ${hud.inventory.hatchetTier}/3` : 'Not Crafted'}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-200">
                    <span>Armor</span>
                    <span className="font-mono-nums text-emerald-300">
                      {hud.inventory.hasArmor ? `Tier ${hud.inventory.armorTier}/3` : 'None'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Side: Crafting Recipes + Forging Station Panel */}
              <div className="md:col-span-8 space-y-4">
                {/* Forging Station Smelting & Upgrades */}
                <div className="bg-amber-950/35 border border-amber-500/35 rounded-xl p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm font-bold text-amber-300">
                      <Flame className="w-4 h-4" />
                      <span>Forging Station (East Map Edge · Marker &quot;F&quot; on Radar)</span>
                    </div>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded ${
                        hud.nearForge ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {hud.nearForge ? 'Connected to Forge' : 'Move to Forge to Smelt/Upgrade'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                    <button
                      onClick={onSmeltMetal}
                      disabled={!hud.nearForge || hud.inventory.metal < 2}
                      className="px-3 py-2 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 transition-colors"
                    >
                      Smelt Alloy (2 Metal)
                    </button>

                    <button
                      onClick={() => onUpgradeGear('pickaxe')}
                      disabled={
                        !hud.nearForge ||
                        hud.inventory.pickaxeTier >= 3 ||
                        hud.inventory.refinedAlloy < (hud.inventory.pickaxeTier === 1 ? 2 : 3)
                      }
                      className="px-3 py-2 rounded-lg text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 transition-colors"
                    >
                      {hud.inventory.pickaxeTier >= 3
                        ? 'Pickaxe Max (T3)'
                        : `Upgrade Pickaxe (${hud.inventory.pickaxeTier === 1 ? 2 : 3} Alloy)`}
                    </button>

                    <button
                      onClick={() => onUpgradeGear('hatchet')}
                      disabled={
                        !hud.nearForge ||
                        !hud.inventory.hasHatchet ||
                        hud.inventory.hatchetTier >= 3 ||
                        hud.inventory.refinedAlloy < (hud.inventory.hatchetTier === 1 ? 2 : 3)
                      }
                      className="px-3 py-2 rounded-lg text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 transition-colors"
                    >
                      {!hud.inventory.hasHatchet
                        ? 'Craft Hatchet First'
                        : hud.inventory.hatchetTier >= 3
                          ? 'Hatchet Max (T3)'
                          : `Upgrade Hatchet (${hud.inventory.hatchetTier === 1 ? 2 : 3} Alloy)`}
                    </button>

                    <button
                      onClick={() => onUpgradeGear('armor')}
                      disabled={
                        !hud.nearForge ||
                        !hud.inventory.hasArmor ||
                        hud.inventory.armorTier >= 3 ||
                        hud.inventory.refinedAlloy < (hud.inventory.armorTier === 1 ? 2 : 3)
                      }
                      className="px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 transition-colors"
                    >
                      {!hud.inventory.hasArmor
                        ? 'Craft Armor First'
                        : hud.inventory.armorTier >= 3
                          ? 'Armor Max (T3)'
                          : `Upgrade Armor (${hud.inventory.armorTier === 1 ? 2 : 3} Alloy)`}
                    </button>
                  </div>
                </div>

                {/* Standard Field Crafting */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {CRAFTING_RECIPES.map((r) => {
                    const owned =
                      (r.id === 'pickaxe' && hud.inventory.hasPickaxe) ||
                      (r.id === 'hatchet' && hud.inventory.hasHatchet) ||
                      (r.id === 'bow' && hud.inventory.hasBow) ||
                      (r.id === 'armor' && hud.inventory.hasArmor);

                    const canAfford =
                      hud.inventory.wood >= r.cost.wood &&
                      hud.inventory.stone >= r.cost.stone &&
                      hud.inventory.fiber >= r.cost.fiber;

                    return (
                      <div
                        key={r.id}
                        className="bg-slate-950/85 border border-white/10 rounded-xl p-3.5 flex flex-col justify-between gap-2.5"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-sm font-semibold text-white">{r.name}</div>
                            <span className="text-[11px] text-slate-400">{r.category}</span>
                          </div>
                          <p className="text-xs text-slate-400 mt-1">{r.description}</p>
                        </div>

                        <div className="space-y-2 pt-2 border-t border-white/10">
                          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-mono-nums">
                            {r.cost.wood > 0 && (
                              <span className={hud.inventory.wood >= r.cost.wood ? 'text-emerald-300' : 'text-red-400'}>
                                Wood {hud.inventory.wood}/{r.cost.wood}
                              </span>
                            )}
                            {r.cost.stone > 0 && (
                              <span className={hud.inventory.stone >= r.cost.stone ? 'text-emerald-300' : 'text-red-400'}>
                                Rocks {hud.inventory.stone}/{r.cost.stone}
                              </span>
                            )}
                            {r.cost.fiber > 0 && (
                              <span className={hud.inventory.fiber >= r.cost.fiber ? 'text-emerald-300' : 'text-red-400'}>
                                Fiber {hud.inventory.fiber}/{r.cost.fiber}
                              </span>
                            )}
                          </div>

                          <button
                            onClick={() => onCraft(r.id)}
                            disabled={owned || !canAfford}
                            className={`w-full py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                              owned
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : canAfford
                                  ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
                                  : 'bg-slate-800 text-slate-500'
                            }`}
                          >
                            {owned ? 'Equipped / Owned' : canAfford ? `Craft ${r.name}` : 'Need Resources'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PAUSE / SETTINGS MODAL (Esc) */}
      {pauseOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/85 pointer-events-auto p-6">
          <div className="w-full max-w-md bg-slate-900 border border-white/15 rounded-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Pause className="w-5 h-5 text-cyan-400" />
                <h2 className="text-xl font-bold text-white font-display">System Paused</h2>
              </div>
              <Settings className="w-4 h-4 text-slate-400" />
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-2">
                  <span>Graphics Quality (Pixels &amp; Resolution)</span>
                  <span className="font-mono-nums text-cyan-300">{hud.renderResolutionLabel}</span>
                </div>
                <div className="grid grid-cols-4 gap-1 bg-slate-950 p-1 rounded-lg border border-white/10">
                  {(['low', 'medium', 'high', 'ultra'] as GraphicsQuality[]).map((q) => (
                    <button
                      key={q}
                      onClick={() => onChangeQuality(q)}
                      className={`py-1.5 text-xs font-semibold capitalize rounded-md ${
                        quality === q ? 'bg-cyan-500 text-slate-950' : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2.5 text-xs">
                <label className="block">
                  <div className="flex justify-between text-slate-300 mb-1">
                    <span>Master Volume</span>
                    <span className="font-mono-nums">{Math.round(volumes.master * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={volumes.master}
                    onChange={(e) => onChangeVolumes(Number(e.target.value), volumes.sfx, volumes.voice)}
                    className="w-full accent-cyan-400"
                  />
                </label>

                <label className="block">
                  <div className="flex justify-between text-slate-300 mb-1">
                    <span>Effects Volume</span>
                    <span className="font-mono-nums">{Math.round(volumes.sfx * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={volumes.sfx}
                    onChange={(e) => onChangeVolumes(volumes.master, Number(e.target.value), volumes.voice)}
                    className="w-full accent-cyan-400"
                  />
                </label>

                <label className="block">
                  <div className="flex justify-between text-slate-300 mb-1">
                    <span>Proximity Voice Volume</span>
                    <span className="font-mono-nums">{Math.round(volumes.voice * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={volumes.voice}
                    onChange={(e) => onChangeVolumes(volumes.master, volumes.sfx, Number(e.target.value))}
                    className="w-full accent-cyan-400"
                  />
                </label>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={onToggleMute}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white rounded-lg"
              >
                {isMuted ? 'Unmute Microphone (M)' : 'Mute Microphone (M)'}
              </button>
              <button
                onClick={onResume}
                className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-400 text-xs font-bold text-slate-950 rounded-lg"
              >
                Resume Mission
              </button>
              <button
                onClick={onExitToLobby}
                className="w-full py-2.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-xs font-semibold text-red-300 rounded-lg"
              >
                Abort Run &amp; Return to Lobby
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VICTORY EXTRACTION / DEFEAT SUMMARY */}
      {(hud.phase === 'victory' || hud.phase === 'defeat') && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/90 pointer-events-auto p-6">
          <div className="w-full max-w-lg bg-slate-900 border border-white/15 rounded-2xl p-8 space-y-6 text-center">
            <div>
              <div
                className={`text-xs font-bold tracking-widest mb-2 ${
                  hud.phase === 'victory' ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {hud.phase === 'victory' ? 'ATLAS SYSTEM DEACTIVATED' : 'CLONE SQUAD CAPTURED'}
              </div>
              <h2 className="text-3xl font-bold text-white font-display">
                {hud.phase === 'victory' ? 'Victory Extraction Ready' : 'Containment Protocol Triggered'}
              </h2>
              <p className="text-sm text-slate-400 mt-2">
                {hud.phase === 'victory'
                  ? 'Orbital colonization directives overridden. Biosphere control transferred to clone survivors.'
                  : 'Clone squad shields depleted. Reinitializing clone backup in drop lobby.'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-left bg-slate-950/80 border border-white/10 rounded-xl p-4 font-mono-nums text-xs">
              <div>
                <div className="text-slate-400">Mission Time</div>
                <div className="text-lg font-bold text-white">
                  {Math.floor(hud.stats.elapsedSeconds / 60)}m{' '}
                  {Math.floor(hud.stats.elapsedSeconds % 60)}s
                </div>
              </div>
              <div>
                <div className="text-slate-400">Damage Dealt</div>
                <div className="text-lg font-bold text-cyan-300">{hud.stats.damageDealt}</div>
              </div>
              <div>
                <div className="text-slate-400">Hostiles Calmed</div>
                <div className="text-lg font-bold text-white">{hud.stats.enemiesDefeated}</div>
              </div>
              <div>
                <div className="text-slate-400">Resources Harvested</div>
                <div className="text-lg font-bold text-emerald-300">
                  {hud.stats.resourcesHarvested}
                </div>
              </div>
            </div>

            <button
              onClick={onExitToLobby}
              className="w-full py-3.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm rounded-xl transition-colors"
            >
              Return to Drop Pod Lobby
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
