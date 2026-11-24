import Peer, { DataConnection, MediaConnection } from 'peerjs';
import { AudioManager } from './AudioManager';
import {
  BeaconStatus,
  BossHudState,
  CloneArchetypeId,
  GamePhase,
  PartyMember,
  ToolSlotId,
} from './types';

export interface PlayerSyncPayload {
  id: string;
  name: string;
  archetype: CloneArchetypeId;
  x: number;
  y: number;
  z: number;
  yaw: number;
  hp: number;
  maxHp: number;
  stamina: number;
  isAlive: boolean;
  isSpeaking: boolean;
  isMuted: boolean;
  hasArmor: boolean;
  activeSlot: ToolSlotId;
  isDashing: boolean;
  isAttacking: boolean;
  attackCombo: number;
}

export interface WorldSyncPayload {
  phase: GamePhase;
  beacons: BeaconStatus[];
  boss: BossHudState;
  bossPos: { x: number; y: number; z: number; yaw: number };
  enemies: Array<{
    id: string;
    kind: 'raptor' | 'theropod' | 'skywing' | 'drone';
    x: number;
    y: number;
    z: number;
    yaw: number;
    hp: number;
    maxHp: number;
    aggroRadius: number;
  }>;
  telegraphs: Array<{
    id: string;
    shape: 'circle' | 'line';
    x: number;
    z: number;
    radius: number;
    angle: number;
    length: number;
    progress: number;
  }>;
  depletedNodes: string[];
}

export type NetMessage =
  | { type: 'lobby_roster'; members: PartyMember[] }
  | { type: 'join_info'; member: PartyMember }
  | { type: 'ready_toggle'; id: string; ready: boolean; name: string; archetype: CloneArchetypeId }
  | { type: 'launch_game' }
  | { type: 'player_state'; player: PlayerSyncPayload }
  | { type: 'world_state'; world: WorldSyncPayload }
  | { type: 'action_harvest'; nodeId: string }
  | { type: 'action_repair'; beaconId: number; amount: number; wood: number; stone: number; metal: number }
  | { type: 'action_damage_enemy'; enemyId: string; dmg: number }
  | { type: 'action_damage_boss'; dmg: number }
  | { type: 'action_trigger_elevator' };

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateInviteCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

export class MultiplayerManager {
  private peer: Peer | null = null;
  private connections: Map<string, DataConnection> = new Map();
  private mediaCalls: Map<string, MediaConnection> = new Map();
  private audio: AudioManager;

  public localId = `local-${Math.random().toString(36).slice(2, 8)}`;
  public isHost = true;
  public isSolo = true;
  public inviteCode = '';
  public connectionStatus: 'idle' | 'connecting' | 'connected' | 'error' = 'idle';
  public errorMessage: string | null = null;

  public localStream: MediaStream | null = null;
  public isMuted = false;
  public micLevel = 0;
  public isSpeaking = false;

  private micAnalyser: AnalyserNode | null = null;
  private micCtx: AudioContext | null = null;
  private micData: Uint8Array<ArrayBuffer> | null = null;

  public members: Map<string, PartyMember> = new Map();

  public onRosterChange: ((members: PartyMember[]) => void) | null = null;
  public onGameLaunch: (() => void) | null = null;
  public onWorldSync: ((world: WorldSyncPayload) => void) | null = null;
  public onClientAction: ((msg: NetMessage, fromId: string) => void) | null = null;
  public onConnectionStatus: ((status: string, error?: string) => void) | null = null;

  constructor(audio: AudioManager) {
    this.audio = audio;
  }

  public async initMicrophone(): Promise<boolean> {
    if (this.localStream) return true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      this.localStream = stream;

      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.micCtx = new AudioCtx();
        const src = this.micCtx.createMediaStreamSource(stream);
        const analyser = this.micCtx.createAnalyser();
        analyser.fftSize = 256;
        src.connect(analyser);
        this.micAnalyser = analyser;
        this.micData = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
      }

      this.applyMuteState();
      return true;
    } catch {
      return false;
    }
  }

  public sampleMicLevel(): { level: number; speaking: boolean } {
    if (this.isMuted || !this.micAnalyser || !this.micData) {
      this.micLevel = 0;
      this.isSpeaking = false;
      return { level: 0, speaking: false };
    }
    this.micAnalyser.getByteFrequencyData(this.micData);
    let sum = 0;
    for (let i = 0; i < this.micData.length; i++) {
      sum += this.micData[i];
    }
    const avg = sum / this.micData.length;
    const normalized = Math.min(1, avg / 65);
    this.micLevel = normalized;
    this.isSpeaking = avg > 12;
    return { level: normalized, speaking: this.isSpeaking };
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    this.applyMuteState();
    return this.isMuted;
  }

  private applyMuteState(): void {
    if (!this.localStream) return;
    for (const track of this.localStream.getAudioTracks()) {
      track.enabled = !this.isMuted;
    }
  }

  public startSolo(name: string, archetype: CloneArchetypeId): void {
    this.disconnect();
    this.isSolo = true;
    this.isHost = true;
    this.inviteCode = '';
    this.connectionStatus = 'connected';
    const localMember = this.createMemberObj(this.localId, name, archetype, true, true);
    this.members.set(this.localId, localMember);
    this.emitRoster();
  }

  public async hostParty(name: string, archetype: CloneArchetypeId): Promise<string> {
    this.disconnect();
    this.isSolo = false;
    this.isHost = true;
    this.connectionStatus = 'connecting';
    this.errorMessage = null;
    this.onConnectionStatus?.('connecting');

    const code = generateInviteCode();
    this.inviteCode = code;
    const peerId = `rba-party-${code}`;

    return new Promise((resolve) => {
      const peer = new Peer(peerId, { debug: 0 });
      this.peer = peer;

      peer.on('open', (id) => {
        this.localId = id;
        this.connectionStatus = 'connected';
        const hostMember = this.createMemberObj(id, name, archetype, true, true);
        this.members.set(id, hostMember);
        this.emitRoster();
        this.onConnectionStatus?.('connected');
        resolve(code);
      });

      peer.on('connection', (conn) => {
        if (this.members.size >= 4) {
          conn.close();
          return;
        }
        this.wireDataConnection(conn);
      });

      peer.on('call', (call) => {
        this.wireMediaCall(call);
      });

      peer.on('error', (err) => {
        this.connectionStatus = 'error';
        this.errorMessage = err.message || 'Peer connection error';
        this.onConnectionStatus?.('error', this.errorMessage);
        resolve(code);
      });
    });
  }

  public async joinParty(
    codeInput: string,
    name: string,
    archetype: CloneArchetypeId,
  ): Promise<boolean> {
    const cleanCode = codeInput.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (cleanCode.length !== 6) {
      this.errorMessage = 'Invite code must be 6 characters.';
      this.onConnectionStatus?.('error', this.errorMessage);
      return false;
    }

    this.disconnect();
    this.isSolo = false;
    this.isHost = false;
    this.inviteCode = cleanCode;
    this.connectionStatus = 'connecting';
    this.errorMessage = null;
    this.onConnectionStatus?.('connecting');

    const hostPeerId = `rba-party-${cleanCode}`;
    const myPeerId = `rba-clone-${cleanCode}-${Math.random().toString(36).slice(2, 6)}`;

    return new Promise((resolve) => {
      const peer = new Peer(myPeerId, { debug: 0 });
      this.peer = peer;

      const timeout = window.setTimeout(() => {
        if (this.connectionStatus !== 'connected') {
          this.connectionStatus = 'error';
          this.errorMessage = 'Party host not found or timed out.';
          this.onConnectionStatus?.('error', this.errorMessage);
          resolve(false);
        }
      }, 9000);

      peer.on('open', (id) => {
        this.localId = id;
        const conn = peer.connect(hostPeerId, { reliable: true });
        this.wireDataConnection(conn, () => {
          window.clearTimeout(timeout);
          this.connectionStatus = 'connected';
          const me = this.createMemberObj(id, name, archetype, false, false);
          this.members.set(id, me);
          conn.send({ type: 'join_info', member: me } satisfies NetMessage);
          this.onConnectionStatus?.('connected');

          if (this.localStream) {
            const call = peer.call(hostPeerId, this.localStream);
            if (call) this.wireMediaCall(call);
          }
          resolve(true);
        });
      });

      peer.on('call', (call) => {
        this.wireMediaCall(call);
      });

      peer.on('error', (err) => {
        window.clearTimeout(timeout);
        this.connectionStatus = 'error';
        this.errorMessage = err.message || 'Unable to reach party.';
        this.onConnectionStatus?.('error', this.errorMessage);
        resolve(false);
      });
    });
  }

  private wireDataConnection(conn: DataConnection, onOpen?: () => void): void {
    conn.on('open', () => {
      this.connections.set(conn.peer, conn);
      onOpen?.();
    });

    conn.on('data', (raw) => {
      const msg = raw as NetMessage;
      this.handleMessage(msg, conn.peer);
    });

    conn.on('close', () => {
      this.connections.delete(conn.peer);
      this.members.delete(conn.peer);
      this.audio.detachRemoteVoiceStream(conn.peer);
      if (this.isHost) {
        this.broadcast({ type: 'lobby_roster', members: Array.from(this.members.values()) });
      }
      this.emitRoster();
    });
  }

  private wireMediaCall(call: MediaConnection): void {
    call.answer(this.localStream || undefined);
    this.mediaCalls.set(call.peer, call);
    call.on('stream', (remoteStream) => {
      this.audio.attachRemoteVoiceStream(call.peer, remoteStream);
    });
    call.on('close', () => {
      this.audio.detachRemoteVoiceStream(call.peer);
      this.mediaCalls.delete(call.peer);
    });
  }

  private handleMessage(msg: NetMessage, fromId: string): void {
    switch (msg.type) {
      case 'join_info': {
        if (this.isHost) {
          this.members.set(msg.member.id, msg.member);
          const roster = Array.from(this.members.values());
          this.broadcast({ type: 'lobby_roster', members: roster });
          this.emitRoster();
          // Host initiates voice call to newly joined peer if localStream is ready
          if (this.peer && this.localStream && !this.mediaCalls.has(msg.member.id)) {
            const call = this.peer.call(msg.member.id, this.localStream);
            if (call) this.wireMediaCall(call);
          }
        }
        break;
      }
      case 'lobby_roster': {
        if (!this.isHost) {
          this.members.clear();
          for (const m of msg.members) {
            this.members.set(m.id, m);
          }
          this.emitRoster();
          // Connect voice to other non-host peers if needed
          if (this.peer && this.localStream) {
            for (const m of msg.members) {
              if (m.id !== this.localId && !this.mediaCalls.has(m.id)) {
                const call = this.peer.call(m.id, this.localStream);
                if (call) this.wireMediaCall(call);
              }
            }
          }
        }
        break;
      }
      case 'ready_toggle': {
        const existing = this.members.get(msg.id);
        if (existing) {
          existing.ready = msg.ready;
          existing.name = msg.name;
          existing.archetype = msg.archetype;
        }
        if (this.isHost) {
          this.broadcast({ type: 'lobby_roster', members: Array.from(this.members.values()) });
        }
        this.emitRoster();
        break;
      }
      case 'launch_game': {
        this.onGameLaunch?.();
        break;
      }
      case 'player_state': {
        const existing = this.members.get(msg.player.id);
        if (existing) {
          Object.assign(existing, msg.player);
        } else {
          this.members.set(msg.player.id, {
            ...msg.player,
            ready: true,
            isHost: false,
          });
        }
        if (this.isHost) {
          // Relay client state to other clients
          for (const [cid, conn] of this.connections.entries()) {
            if (cid !== fromId && conn.open) {
              conn.send(msg);
            }
          }
        }
        break;
      }
      case 'world_state': {
        if (!this.isHost) {
          this.onWorldSync?.(msg.world);
        }
        break;
      }
      case 'action_harvest':
      case 'action_repair':
      case 'action_damage_enemy':
      case 'action_damage_boss':
      case 'action_trigger_elevator': {
        if (this.isHost) {
          this.onClientAction?.(msg, fromId);
        }
        break;
      }
    }
  }

  public updateLocalLobbyProfile(name: string, archetype: CloneArchetypeId, ready: boolean): void {
    const me = this.members.get(this.localId);
    if (me) {
      me.name = name;
      me.archetype = archetype;
      me.ready = ready;
    }
    if (this.isHost) {
      this.broadcast({ type: 'lobby_roster', members: Array.from(this.members.values()) });
      this.emitRoster();
    } else {
      this.broadcast({
        type: 'ready_toggle',
        id: this.localId,
        ready,
        name,
        archetype,
      });
      this.emitRoster();
    }
  }

  public launchGame(): void {
    if (!this.isHost) return;
    this.broadcast({ type: 'launch_game' });
    this.onGameLaunch?.();
  }

  public sendLocalPlayerState(player: PlayerSyncPayload): void {
    const existing = this.members.get(this.localId);
    if (existing) {
      Object.assign(existing, player);
    }
    if (!this.isSolo) {
      this.broadcast({ type: 'player_state', player });
    }
  }

  public sendWorldState(world: WorldSyncPayload): void {
    if (!this.isHost || this.isSolo) return;
    this.broadcast({ type: 'world_state', world });
  }

  public sendClientAction(msg: NetMessage): void {
    if (this.isHost) {
      this.onClientAction?.(msg, this.localId);
    } else {
      this.broadcast(msg);
    }
  }

  public broadcast(msg: NetMessage): void {
    for (const conn of this.connections.values()) {
      if (conn.open) {
        conn.send(msg);
      }
    }
  }

  private createMemberObj(
    id: string,
    name: string,
    archetype: CloneArchetypeId,
    ready: boolean,
    isHost: boolean,
  ): PartyMember {
    return {
      id,
      name,
      archetype,
      ready,
      isHost,
      hp: 100,
      maxHp: 100,
      stamina: 100,
      isAlive: true,
      isSpeaking: false,
      isMuted: this.isMuted,
      x: 0,
      y: 0,
      z: 30,
      yaw: 0,
      hasArmor: false,
      activeSlot: 'pickaxe',
      isDashing: false,
      isAttacking: false,
      attackCombo: 0,
    };
  }

  private emitRoster(): void {
    this.onRosterChange?.(Array.from(this.members.values()));
  }

  public disconnect(): void {
    for (const conn of this.connections.values()) {
      conn.close();
    }
    this.connections.clear();
    for (const call of this.mediaCalls.values()) {
      call.close();
    }
    this.mediaCalls.clear();
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    this.members.clear();
    this.connectionStatus = 'idle';
    this.errorMessage = null;
  }
}
