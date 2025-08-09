import { Html } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useGameOrchestrator } from '@/react/GameOrchestrator';
import type { WeaponComponent, ScoreComponent, CombatFeedbackComponent, WaveStatusComponent } from '@/components/GameplayComponents';

type AimHUDLike = {
  name?: string;
  healthPct?: number; // 0..100
};

function useHeading(): number {
  const { camera } = useThree();
  const v = useMemo(() => new THREE.Vector3(), []);
  const [deg, setDeg] = useState<number>(0);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const dir = camera.getWorldDirection(v).setY(0).normalize();
      // atan2(x, z) -> yaw; convert to degrees [0,360)
      const yaw = Math.atan2(dir.x, dir.z);
      const d = (THREE.MathUtils.radToDeg(yaw) + 360) % 360;
      setDeg(d);
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [camera, v]);
  return deg;
}

export function HUD() {
  const boot = useGameOrchestrator();
  const heading = useHeading();
  const [waveClear, setWaveClear] = useState<boolean>(false);

  // Weapon/ammo
  const ammo = useMemo(() => {
    if (!boot) {
      return { ammo: 0, maxAmmo: 0 } as const;
    }
    const wc = boot.entityManager.getComponent<WeaponComponent>(boot.playerEntity, 'WeaponComponent');
    return wc ? ({ ammo: wc.ammo, maxAmmo: wc.maxAmmo } as const) : ({ ammo: 0, maxAmmo: 0 } as const);
  }, [boot]);

  const isReloading = useMemo(() => {
    if (!boot) {
      return false;
    }
    const wc = boot.entityManager.getComponent<WeaponComponent>(boot.playerEntity, 'WeaponComponent');
    return wc ? wc.isReloading === true : false;
  }, [boot]);

  // Score/hits/kills
  const score = useMemo(() => {
    if (!boot) {
      return { score: 0, hits: 0, kills: 0 } as const;
    }
    const sc = boot.entityManager.getComponent<ScoreComponent>(boot.playerEntity, 'ScoreComponent');
    return sc ? ({ score: sc.score, hits: sc.hits, kills: sc.kills } as const) : ({ score: 0, hits: 0, kills: 0 } as const);
  }, [boot]);

  // ADS + fire
  const inputState = boot ? boot.inputSystem.getInputState() : undefined;
  const isADS = inputState ? inputState.rightClick === true : false;
  const leftDown = inputState ? inputState.leftClick === true : false;

  // Recoil pulse on fire intent (edge detect from left click stays as a simple proxy)
  const recoilRef = useRef<number>(0);
  const [recoilOn, setRecoilOn] = useState<boolean>(false);
  const leftPrevRef = useRef<boolean>(false);
  useEffect(() => {
    const prev = leftPrevRef.current;
    leftPrevRef.current = leftDown;
    if (!prev && leftDown) {
      setRecoilOn(true);
      if (recoilRef.current) {
        window.clearTimeout(recoilRef.current);
      }
      recoilRef.current = window.setTimeout(() => setRecoilOn(false), 110);
    }
  }, [leftDown]);

  // Target info (optional; only shows if Aim component exposes name/healthPct)
  const aim = useMemo(() => {
    if (!boot) {
      return { name: undefined, healthPct: undefined } as const;
    }
    // Try to read an Aim-like component if present; guard all access
    const comp = boot.entityManager.getComponent<unknown>(boot.playerEntity, 'AimComponent') as AimHUDLike | undefined;
    const name = comp?.name;
    const healthPct = comp?.healthPct;
    return { name, healthPct } as const;
  }, [boot]);

  // Crosshair size reacts to ADS; recoil applies transient transform
  const crosshairSize = isADS ? 'w-1 h-1' : 'w-2 h-2';
  const crosshairGap = isADS ? 'gap-[3px]' : 'gap-1.5';

  // Hitmarker state from ECS CombatFeedbackComponent on player
  const [hitState, setHitState] = useState<'hit' | 'crit' | 'miss' | 'none'>('none');
  const [hitPop, setHitPop] = useState<boolean>(false);
  const lastVersionRef = useRef<number>(0);
  useEffect(() => {
    if (!boot) {
      return;
    }
    let raf = 0;
    const tick = () => {
      const fb = boot.entityManager.getComponent<CombatFeedbackComponent>(boot.playerEntity, 'CombatFeedbackComponent');
      if (fb && fb.version !== lastVersionRef.current) {
        lastVersionRef.current = fb.version;
        setHitState(fb.state);
        setHitPop(true);
        window.setTimeout(() => setHitPop(false), 130);
      }
      // Wave clear badge window
      const ws = boot.entityManager.getComponent<WaveStatusComponent>(boot.playerEntity, 'WaveStatusComponent');
      if (ws) {
        const now = Date.now() / 1000;
        setWaveClear(ws.state === 'clear' && now < ws.showUntil);
      } else {
        setWaveClear(false);
      }
      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [boot]);

  const lowHealth = typeof aim.healthPct === 'number' && aim.healthPct <= 25;

  // Update global CSS var for target health to avoid inline style usage
  useEffect(() => {
    const pct = Math.max(0, Math.min(100, aim.healthPct ?? 0));
    document.documentElement.style.setProperty('--hud-health', `${pct}%`);
    return () => {
      // optional cleanup: revert to 0%
      document.documentElement.style.setProperty('--hud-health', '0%');
    };
  }, [aim.healthPct]);

  return (
    <>
      {/* Crosshair (center) with recoil feedback */}
      <Html pointerEvents="none" center>
        <div className={`hud-crosshair ${recoilOn ? 'data-[recoil=on]:translate-y-[-2px]' : ''}`} data-recoil={recoilOn ? 'on' : 'off'}>
          <div className={`relative ${crosshairGap}`}>
            <div className={`absolute -translate-x-1/2 -translate-y-1/2 ${crosshairSize} bg-white/90 rounded-sm`}></div>
          </div>
        </div>
      </Html>

      {/* Hit marker (center) */}
      <Html pointerEvents="none" center>
        <div className="hud-hitmarker" data-state={hitState} data-feedback={hitPop ? 'pop' : 'off'}>
          <div className="hud-hitmarker-dot" />
        </div>
      </Html>

      {/* Wave Clear badge (top-center) */}
      {waveClear ? (
        <Html pointerEvents="none" center>
          <div className="hud-badge">WAVE CLEAR</div>
        </Html>
      ) : null}

      {/* Target info (top-center) */}
      {aim.name ? (
        <Html pointerEvents="none" fullscreen>
          <div className="hud-target">
            <div className="hud-target-box">
              <span className="hud-target-name">{aim.name}</span>
            </div>
            <div className="hud-target-health" data-low={lowHealth ? 'true' : 'false'}>
              <div className="hud-target-health-fill" />
            </div>
          </div>
        </Html>
      ) : null}

      {/* Ammo (bottom-right) */}
      <Html pointerEvents="none" fullscreen>
        <div className="hud-ammo">
          <span className="hud-badge">{ammo.ammo}/{ammo.maxAmmo}</span>
          {isReloading && (
            <span className="hud-badge ml-2">RELOADING</span>
          )}
          {!isReloading && ammo.ammo === 0 && (
            <span className="hud-badge ml-2">RELOAD [R]</span>
          )}
        </div>
      </Html>

      {/* Score (bottom-left) */}
      <Html pointerEvents="none" fullscreen>
        <div className="hud-score">
          <span className="hud-badge">Score {score.score}</span>
          <span className="hud-badge ml-2">H {score.hits}</span>
          <span className="hud-badge ml-2">K {score.kills}</span>
        </div>
      </Html>

      {/* Compass (top-center) */}
      <Html pointerEvents="none" fullscreen>
        <div className="hud-compass">
          <div className="hud-compass-box">
            <span className="text-neutral-300">N</span>
            <span className="text-neutral-500">E</span>
            <span className="text-neutral-500">S</span>
            <span className="text-neutral-500">W</span>
            <span className="ml-2 text-neutral-200">{Math.round(heading)}°</span>
          </div>
        </div>
      </Html>

      {/* Aim-in indicator (bottom-center) */}
      <Html pointerEvents="none" fullscreen>
        <div className="hud-aim">
          <div className={`hud-badge ${isADS ? 'hud-aim-ads' : 'hud-aim-hip'}`}>{isADS ? 'ADS' : 'HIP'}</div>
        </div>
      </Html>
    </>
  );
}

export default HUD;
