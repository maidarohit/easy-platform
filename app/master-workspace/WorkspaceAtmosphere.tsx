"use client";

import { startTransition, useEffect, useState } from "react";
import { buildWorkspaceAtmosphere } from "@/app/lib/master-workspace-atmosphere";
import styles from "./WorkspaceAtmosphere.module.css";

type WorkspaceAtmosphereProps = Readonly<{
  projectId: string;
  businessName?: string | null;
  industry?: string | null;
  businessDescription?: string | null;
  brandStyle?: string | null;
  brandingOutput?: Record<string, unknown> | null;
  websiteOutput?: Record<string, unknown> | null;
}>;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function opacityHex(hex: string, opacity: string) {
  return `${hex}${opacity}`;
}

export default function WorkspaceAtmosphere(props: WorkspaceAtmosphereProps) {
  const [enabled, setEnabled] = useState(true);
  const [sceneOffset, setSceneOffset] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const enabledKey = `buzypeezy:workspace-atmosphere:${props.projectId}:enabled`;
    const sceneKey = `buzypeezy:workspace-atmosphere:${props.projectId}:scene-offset`;
    const savedEnabled = window.localStorage.getItem(enabledKey);
    const savedScene = window.sessionStorage.getItem(sceneKey);
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");

    setEnabled(savedEnabled !== "off");
    setSceneOffset(Number(savedScene ?? "0") || 0);
    setReducedMotion(media.matches);
    setHydrated(true);

    const onChange = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [props.projectId]);

  const atmosphere = buildWorkspaceAtmosphere({
    projectId: props.projectId,
    businessName: props.businessName,
    industry: props.industry,
    businessDescription: props.businessDescription,
    brandStyle: props.brandStyle,
    brandingOutput: props.brandingOutput,
    websiteOutput: props.websiteOutput,
    dayKey: todayKey(),
    sceneOffset,
    reducedMotion,
  });

  const accentA = atmosphere.accentColors[0] ?? "#2F8F78";
  const accentB = atmosphere.accentColors[1] ?? "#D8B36A";
  const accentC = atmosphere.accentColors[2] ?? "#7BC8D8";

  const setAtmosphereEnabled = (nextValue: boolean) => {
    startTransition(() => setEnabled(nextValue));
    window.localStorage.setItem(
      `buzypeezy:workspace-atmosphere:${props.projectId}:enabled`,
      nextValue ? "on" : "off",
    );
  };

  const rotateScene = () => {
    startTransition(() => setSceneOffset((current) => {
      const nextValue = current + 1;
      window.sessionStorage.setItem(
        `buzypeezy:workspace-atmosphere:${props.projectId}:scene-offset`,
        String(nextValue),
      );
      return nextValue;
    }));
  };

  if (!hydrated) return null;

  const atmosphereClassName = [styles.atmosphere, "absolute inset-0"].join(" ");
  const washClassName = [styles.wash, "absolute inset-0"].join(" ");
  const orbLeftClassName = [styles.orb, "absolute left-[-10%] top-[8%] h-[26rem] w-[26rem] rounded-full blur-3xl"].join(" ");
  const orbRightClassName = [styles.orb, styles.orbRight, "absolute right-[-6%] top-[24%] h-[24rem] w-[24rem] rounded-full blur-3xl"].join(" ");
  const orbBottomClassName = [styles.orb, styles.orbBottom, "absolute bottom-[-12%] left-[24%] h-[22rem] w-[22rem] rounded-full blur-3xl"].join(" ");
  const mistClassName = [styles.mist, "absolute inset-0"].join(" ");

  return (
    <>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[#F7F3E9]" />
        {enabled && (
          <div className={atmosphereClassName} data-motion={atmosphere.motionMode}>
            {atmosphere.image && (
              <div className={styles.imageShell}>
                <img
                  src={atmosphere.image.src}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className={styles.image}
                />
              </div>
            )}
            <div
              className={washClassName}
              style={{ backgroundImage: atmosphere.scene.background }}
            />
            <div
              className={orbLeftClassName}
              style={{ background: `radial-gradient(circle, ${atmosphere.scene.orbA} 0%, transparent 68%)` }}
            />
            <div
              className={orbRightClassName}
              style={{ background: `radial-gradient(circle, ${atmosphere.scene.orbB} 0%, transparent 70%)` }}
            />
            <div
              className={orbBottomClassName}
              style={{ background: `radial-gradient(circle, ${atmosphere.scene.orbC} 0%, transparent 72%)` }}
            />
            <div
              className="absolute inset-0 opacity-70"
              style={{
                backgroundImage: `radial-gradient(circle at 18% 18%, ${opacityHex(accentA, "2A")} 0%, transparent 28%), radial-gradient(circle at 82% 20%, ${opacityHex(accentB, "24")} 0%, transparent 26%), radial-gradient(circle at 48% 78%, ${opacityHex(accentC, "20")} 0%, transparent 24%)`,
              }}
            />
            <div
              className={mistClassName}
              style={{
                backgroundImage: `linear-gradient(180deg, ${atmosphere.scene.mist} 0%, rgba(252,251,247,0.18) 34%, rgba(247,243,233,0.72) 100%)`,
              }}
            />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.3),transparent_36%)]" />
          </div>
        )}
      </div>

      <div className="pointer-events-auto fixed bottom-4 right-4 z-30 max-w-[14rem] md:bottom-5 md:right-5">
        <div className="rounded-[18px] border border-white/70 bg-white/72 p-2.5 shadow-[0_16px_36px_rgba(36,55,48,0.08)] backdrop-blur-xl">
          <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-[#8A713F]">
            Workspace appearance
          </p>
          <p className="mt-1.5 text-xs font-semibold text-[#103C32]">
            {enabled ? atmosphere.scene.label : "Dynamic atmosphere off"}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setAtmosphereEnabled(!enabled)}
              className={`rounded-full border px-2.5 py-1.5 text-[11px] font-semibold ${
                enabled
                  ? "border-[#2F8F78] bg-[#EFF8F4] text-[#1D6B57]"
                  : "border-[#D8DCCF] bg-white text-[#66756F]"
              }`}
            >
              Atmosphere {enabled ? "On" : "Off"}
            </button>
            <button
              type="button"
              onClick={rotateScene}
              className="rounded-full border border-[#D7C694] bg-[#FFF7E7] px-2.5 py-1.5 text-[11px] font-semibold text-[#7A5C20]"
            >
              Scene
            </button>
          </div>
          <p className="mt-2 text-[11px] leading-4 text-[#66756F]">
            {reducedMotion
              ? "Static mode is on."
              : atmosphere.image
                ? `${atmosphere.image.source === "uploaded" ? "Your photo" : "Scene photo"} with ${atmosphere.category.replace(/-/g, " ")} atmosphere`
                : `${atmosphere.category.replace(/-/g, " ")} atmosphere`}
          </p>
        </div>
      </div>
    </>
  );
}
