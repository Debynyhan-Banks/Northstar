"use client";

import { useEffect } from "react";
import { initGrowthWorkspace } from "./growth-workspace";

declare global {
  interface Window {
    CF_PORTAL_CONFIG?: { supabaseUrl?: string; supabaseAnonKey?: string; companyName?: string };
  }
}

let configPromise: Promise<void> | undefined;

function loadConfig(): Promise<void> {
  if (!configPromise) {
    configPromise = new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "/portal-config.js";
      script.onload = () => resolve();
      script.onerror = () => resolve();
      document.head.appendChild(script);
    });
  }
  return configPromise;
}

export default function Questionnaire() {
  useEffect(() => {
    let active = true;
    let dispose: (() => void) | undefined;
    void loadConfig().then(() => {
      if (active) dispose = initGrowthWorkspace(window.CF_PORTAL_CONFIG);
    });
    return () => { active = false; dispose?.(); };
  }, []);

  return <><div id="root"><div className="loading"><div className="loader-mark">CF</div><p>Loading the C.F. Mechanical workspace…</p></div></div><div id="toast" aria-live="polite" /></>;
}
