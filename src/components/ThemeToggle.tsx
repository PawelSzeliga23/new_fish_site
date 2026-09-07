"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // localStorage może być niedostępny (np. tryb prywatny) - motyw po prostu nie przetrwa odświeżenia
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Przełącz motyw"
      className="flex w-full items-center gap-4 rounded-full px-3 py-3 text-base transition-colors hover:bg-muted"
    >
      {isDark ? <Sun size={24} /> : <Moon size={24} />}
      <span className="hidden lg:inline">{isDark ? "Jasny" : "Ciemny"}</span>
    </button>
  );
}
