"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type Contrast = "normal" | "high";
type TextScale = "100" | "115" | "130";

interface UIPreferences {
    contrast: Contrast;
    textScale: TextScale;
    reduceMotion: boolean;
    streetMode: boolean;
}

interface UIPreferencesContextType extends UIPreferences {
    setContrast: (c: Contrast) => void;
    setTextScale: (s: TextScale) => void;
    setReduceMotion: (r: boolean) => void;
    setStreetMode: (s: boolean) => void;
}

const UIPreferencesContext = createContext<UIPreferencesContextType | undefined>(undefined);

export function UIPreferencesProvider({ children }: { children: React.ReactNode }) {
    const [contrast, setContrast] = useState<Contrast>("normal");
    const [textScale, setTextScale] = useState<TextScale>("100");
    const [reduceMotion, setReduceMotion] = useState(false);
    const [streetMode, setStreetMode] = useState(false);

    // Initial load from localStorage
    useEffect(() => {
        const saved = localStorage.getItem("eco_ui_prefs");
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (parsed.contrast) setContrast(parsed.contrast);
                if (parsed.textScale) setTextScale(parsed.textScale);
                if (parsed.reduceMotion !== undefined) setReduceMotion(parsed.reduceMotion);
                if (parsed.streetMode !== undefined) setStreetMode(parsed.streetMode);
            } catch (e) {
                console.error("Failed to parse UI prefs", e);
            }
        }
    }, []);

    // Persist and apply to DOM
    useEffect(() => {
        const prefs = { contrast, textScale, reduceMotion, streetMode };
        localStorage.setItem("eco_ui_prefs", JSON.stringify(prefs));

        const root = document.documentElement;
        root.dataset.uiContrast = contrast;
        root.dataset.uiTextScale = textScale;
        root.dataset.uiReduceMotion = String(reduceMotion);
        root.dataset.uiStreetMode = String(streetMode);

        // Forced accessibility classes for easier CSS targets
        if (streetMode) root.classList.add("street-mode");
        else root.classList.remove("street-mode");

    }, [contrast, textScale, reduceMotion, streetMode]);

    return (
        <UIPreferencesContext.Provider value={{
            contrast, setContrast,
            textScale, setTextScale,
            reduceMotion, setReduceMotion,
            streetMode, setStreetMode
        }}>
            {children}
        </UIPreferencesContext.Provider>
    );
}

export function useUIPreferences() {
    const context = useContext(UIPreferencesContext);
    if (context === undefined) {
        throw new Error("useUIPreferences must be used within a UIPreferencesProvider");
    }
    return context;
}
