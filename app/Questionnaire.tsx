"use client";

import { useEffect } from "react";
import { initQuestionnaire } from "./intake-wizard";

let configPromise: Promise<void> | undefined;

function loadConfig(): Promise<void> {
  if (!configPromise) {
    configPromise = new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "/config.js";
      script.onload = () => resolve();
      // A missing configuration must leave the download-only mode available.
      script.onerror = () => resolve();
      document.head.appendChild(script);
    });
  }
  return configPromise;
}

export default function Questionnaire() {
  useEffect(() => {
    let active = true;
    void loadConfig().then(() => {
      if (active) initQuestionnaire();
    });
    return () => { active = false; };
  }, []);

  return (
    <>
      <header className="top"><div className="top-inner"><div className="brand"><div className="mark">CF</div><div><strong>C.F. MECHANICAL</strong><span>BUSINESS DISCOVERY</span></div></div><div className="topnote">Private owner questionnaire<br />Commercial &amp; Industrial Mechanical</div></div></header>
      <section className="hero"><div className="hero-inner"><div className="eyebrow">A clear plan starts with your vision</div><h1>Let&apos;s build the future<br />of C.F. Mechanical.</h1><p>Answer a few simple questions about the business, the work you want, and how we should grow. There are no wrong answers. You can skip anything you don&apos;t know.</p><div className="hero-stats"><span className="chip">9 guided steps</span><span className="chip">About 20–30 minutes</span><span className="chip">Answers saved on this device</span></div></div></section>
      <main><div className="surface workspace"><aside className="aside"><p className="aside-heading">Your progress</p><nav className="steps" id="steps" aria-label="Questionnaire sections" /><div className="sidehint"><strong>Need a break?</strong><br />Your answers save automatically on this browser. Select any step to return later.</div></aside><section className="content" aria-live="polite"><div id="app"><p>Loading the questionnaire…</p><noscript>Enable JavaScript to complete the questionnaire.</noscript></div></section></div></main>
    </>
  );
}
