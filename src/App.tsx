import { useEffect, useRef, useState } from 'react';
import { AudioManager } from './AudioManager';
import { GameEngine } from './GameEngine';
import { MultiplayerManager } from './MultiplayerManager';
import { GameHud, LoadingScreen, LobbyScreen } from './UIOverlays';
import {
  AppScreen,
  CloneArchetypeId,
  GraphicsQuality,
  HudSnapshot,
  PartyMember,
  ToolSlotId,
} from './types';

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<AudioManager | null>(null);
  const mpRef = useRef<MultiplayerManager | null>(null);
  const engineRef = useRef<GameEngine | null>(null);

  const [screen, setScreen] = useState<AppScreen>('loading');
  const [loadLabel, setLoadLabel] = useState('INITIALIZING CLONE PODS...');
  const [loadProgress, setLoadProgress] = useState(0);

  const [playerName, setPlayerName] = useState('Atlas-Clone');
  const [archetype, setArchetype] = useState<CloneArchetypeId>('tank');
  const [quality, setQuality] = useState<GraphicsQuality>('high');

  const [partyMembers, setPartyMembers] = useState<PartyMember[]>([]);
  const [inviteCode, setInviteCode] = useState('');
  const [isHost, setIsHost] = useState(true);
  const [isSolo, setIsSolo] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [micEnabled, setMicEnabled] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [micLevel, setMicLevel] = useState(0);

  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const [craftingOpen, setCraftingOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [noticeText, setNoticeText] = useState<string | null>(null);
  const [volumes, setVolumes] = useState({ master: 0.75, sfx: 0.85, voice: 0.9 });

  const profileRef = useRef({ playerName, archetype });
  profileRef.current = { playerName, archetype };
  const noticeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const audio = new AudioManager();
    const mp = new MultiplayerManager(audio);
    const engine = new GameEngine(mount, audio, mp);

    audioRef.current = audio;
    mpRef.current = mp;
    engineRef.current = engine;

    mp.onRosterChange = (members) => {
      setPartyMembers(members);
      setIsHost(mp.isHost);
      setIsSolo(mp.isSolo);
      setInviteCode(mp.inviteCode);
    };

    mp.onConnectionStatus = (status, err) => {
      setConnectionStatus(status);
      setErrorMessage(err ?? null);
    };

    mp.onGameLaunch = () => {
      setCraftingOpen(false);
      setAdminOpen(false);
      setPauseOpen(false);
      setScreen('playing');
      engine.startRun(profileRef.current.playerName, profileRef.current.archetype);
    };

    engine.onHudUpdate = (snapshot) => {
      setHud(snapshot);
    };
    engine.onToggleCrafting = (open) => {
      setCraftingOpen(open);
    };
    engine.onToggleAdmin = (open) => {
      setAdminOpen(open);
    };
    engine.onTogglePause = (paused) => {
      setPauseOpen(paused);
    };
    engine.onMuteToggle = () => {
      const muted = mp.toggleMute();
      setIsMuted(muted);
    };
    engine.onNotice = (msg) => {
      setNoticeText(msg);
      if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = window.setTimeout(() => setNoticeText(null), 2400);
    };

    let cancelled = false;
    void engine
      .initialize((label, pct) => {
        if (cancelled) return;
        setLoadLabel(label);
        setLoadProgress(pct);
      })
      .then(() => {
        if (cancelled) return;
        mp.startSolo(profileRef.current.playerName, profileRef.current.archetype);
        setScreen('lobby');
      });

    const micInterval = window.setInterval(() => {
      if (mpRef.current) {
        const res = mpRef.current.sampleMicLevel();
        setMicLevel(res.level);
      }
    }, 90);

    return () => {
      cancelled = true;
      window.clearInterval(micInterval);
      if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
      engine.dispose();
      mp.disconnect();
      audio.dispose();
    };
  }, []);

  useEffect(() => {
    if (screen !== 'lobby' || !mpRef.current) return;
    const me = mpRef.current.members.get(mpRef.current.localId);
    mpRef.current.updateLocalLobbyProfile(
      playerName.trim() || 'Clone',
      archetype,
      me?.ready ?? mpRef.current.isHost,
    );
  }, [playerName, archetype, screen]);

  const handleEnableMic = async () => {
    if (!mpRef.current) return;
    const ok = await mpRef.current.initMicrophone();
    setMicEnabled(ok);
    if (!ok) {
      setErrorMessage('Microphone permission denied or no audio input device detected.');
    }
  };

  const handleToggleMute = () => {
    if (!mpRef.current) return;
    const muted = mpRef.current.toggleMute();
    setIsMuted(muted);
  };

  const handleHostParty = async () => {
    if (!mpRef.current) return;
    await mpRef.current.hostParty(playerName.trim() || 'Host-Clone', archetype);
  };

  const handleJoinParty = async (code: string) => {
    if (!mpRef.current) return;
    await mpRef.current.joinParty(code, playerName.trim() || 'Client-Clone', archetype);
  };

  const handleSoloRun = () => {
    if (!mpRef.current) return;
    mpRef.current.startSolo(playerName.trim() || 'Solo-Clone', archetype);
  };

  const handleToggleReady = () => {
    if (!mpRef.current) return;
    const me = mpRef.current.members.get(mpRef.current.localId);
    mpRef.current.updateLocalLobbyProfile(
      playerName.trim() || 'Clone',
      archetype,
      !(me?.ready ?? false),
    );
  };

  const handleLaunchGame = () => {
    audioRef.current?.unlock();
    mpRef.current?.launchGame();
  };

  const handleChangeQuality = (q: GraphicsQuality) => {
    setQuality(q);
    engineRef.current?.setGraphicsQuality(q);
  };

  const handleChangeVolumes = (master: number, sfx: number, voice: number) => {
    setVolumes({ master, sfx, voice });
    audioRef.current?.setVolumes(master, sfx, voice);
  };

  const handleExitToLobby = () => {
    engineRef.current?.stopRun();
    setPauseOpen(false);
    setCraftingOpen(false);
    setAdminOpen(false);
    setHud(null);
    setScreen('lobby');
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950">
      <div ref={canvasMountRef} className="absolute inset-0 w-full h-full" />

      {screen === 'loading' && (
        <LoadingScreen statusLabel={loadLabel} progress={loadProgress} />
      )}

      {screen === 'lobby' && (
        <LobbyScreen
          playerName={playerName}
          setPlayerName={setPlayerName}
          archetype={archetype}
          setArchetype={setArchetype}
          quality={quality}
          setQuality={handleChangeQuality}
          partyMembers={partyMembers}
          localId={mpRef.current?.localId ?? ''}
          isHost={isHost}
          isSolo={isSolo}
          inviteCode={inviteCode}
          connectionStatus={connectionStatus}
          errorMessage={errorMessage}
          micLevel={micLevel}
          isMuted={isMuted}
          micEnabled={micEnabled}
          onEnableMic={() => void handleEnableMic()}
          onToggleMute={handleToggleMute}
          onHostParty={() => void handleHostParty()}
          onJoinParty={(code) => void handleJoinParty(code)}
          onSoloRun={handleSoloRun}
          onToggleReady={handleToggleReady}
          onLaunchGame={handleLaunchGame}
        />
      )}

      {screen === 'playing' && hud && (
        <GameHud
          hud={hud}
          partyMembers={partyMembers}
          localId={mpRef.current?.localId ?? ''}
          localArchetype={archetype}
          isHost={isHost}
          isMuted={isMuted}
          craftingOpen={craftingOpen}
          adminOpen={adminOpen}
          pauseOpen={pauseOpen}
          noticeText={noticeText}
          quality={quality}
          volumes={volumes}
          onOpenCrafting={() => {
            setCraftingOpen(true);
            engineRef.current?.setCraftingOpen(true);
          }}
          onCloseCrafting={() => {
            setCraftingOpen(false);
            engineRef.current?.setCraftingOpen(false);
          }}
          onOpenAdmin={() => {
            setAdminOpen(true);
            engineRef.current?.setAdminOpen(true);
          }}
          onCloseAdmin={() => {
            setAdminOpen(false);
            engineRef.current?.setAdminOpen(false);
          }}
          onAdminJumpElevatorReady={() => {
            engineRef.current?.adminJumpToElevatorReady();
          }}
          onAdminStartElevatorRide={() => {
            engineRef.current?.adminStartElevatorRide();
          }}
          onAdminTriggerBossWake={() => {
            engineRef.current?.adminTriggerBossWake();
          }}
          onAdminShowcaseBoss={(stage, forceDescend) => {
            engineRef.current?.adminShowcaseBoss(stage, forceDescend);
          }}
          onAdminForceBossDescend={() => {
            engineRef.current?.adminForceBossDescend();
          }}
          onAdminGrantMaxGear={() => {
            engineRef.current?.adminGrantMaxGear();
          }}
          onAdminToggleGodMode={() => {
            engineRef.current?.adminToggleGodMode();
          }}
          onCraft={(id) => {
            engineRef.current?.craftItem(id);
          }}
          onSmeltMetal={() => {
            engineRef.current?.smeltMetal();
          }}
          onUpgradeGear={(kind) => {
            engineRef.current?.upgradeGear(kind);
          }}
          onSelectSlot={(slot: ToolSlotId) => {
            engineRef.current?.selectSlot(slot);
          }}
          onResume={() => {
            setPauseOpen(false);
            engineRef.current?.setPaused(false);
          }}
          onChangeQuality={handleChangeQuality}
          onChangeVolumes={handleChangeVolumes}
          onToggleMute={handleToggleMute}
          onExitToLobby={handleExitToLobby}
          onRequestPointerLock={() => {
            engineRef.current?.requestPointerLock();
          }}
        />
      )}
    </div>
  );
}
