"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";

import { Button } from "./button";

export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "ui-theme";
const THEME_CHANGE_EVENT = "ui-theme-change";

function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

function readTheme(): Theme {
  if (typeof window === "undefined") {
    return "system";
  }

  const storedTheme = window.localStorage.getItem(STORAGE_KEY);
  return isTheme(storedTheme) ? storedTheme : "system";
}

function subscribeToTheme(onStoreChange: () => void): () => void {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      onStoreChange();
    }
  };
  const handleThemeChange = () => {
    onStoreChange();
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(THEME_CHANGE_EVENT, handleThemeChange);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(THEME_CHANGE_EVENT, handleThemeChange);
  };
}

export function useTheme(): readonly [Theme, (theme: Theme) => void] {
  const theme = useSyncExternalStore(subscribeToTheme, readTheme, (): Theme => "system");

  const setTheme = (nextTheme: Theme) => {
    window.localStorage.setItem(STORAGE_KEY, nextTheme);
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  };

  return [theme, setTheme] as const;
}

export interface ThemeProviderProperties {
  readonly children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProperties) {
  const [theme] = useTheme();

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const root = document.documentElement;
    const applyTheme = () => {
      const resolvedTheme = theme === "system" ? (media.matches ? "dark" : "light") : theme;
      root.classList.toggle("dark", resolvedTheme === "dark");
      root.classList.toggle("light", resolvedTheme === "light");
      root.dataset.theme = theme;
    };

    applyTheme();
    if (theme === "system") {
      media.addEventListener("change", applyTheme);
    }

    return () => {
      media.removeEventListener("change", applyTheme);
    };
  }, [theme]);

  return children;
}

const themeDetails = {
  system: {
    label: "System",
    next: "light",
    nextLabel: "light",
    Icon: Monitor,
  },
  light: {
    label: "Light",
    next: "dark",
    nextLabel: "dark",
    Icon: Sun,
  },
  dark: {
    label: "Dark",
    next: "system",
    nextLabel: "system",
    Icon: Moon,
  },
} as const;

export function ThemeToggle() {
  const [theme, setTheme] = useTheme();
  const details = themeDetails[theme];

  return (
    <Button
      type="button"
      variant="outline"
      size="compact"
      onClick={() => {
        setTheme(details.next);
      }}
      aria-label={`${details.label} theme. Activate to use ${details.nextLabel} theme.`}
    >
      <details.Icon aria-hidden="true" />
      <span>{details.label}</span>
    </Button>
  );
}
