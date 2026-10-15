"use client";
/**
 * Point d'entrée du build de prévisualisation.
 *
 * Il importe LES MÊMES écrans et le MÊME moteur que l'application Next :
 * seuls le routeur et l'enveloppe HTML changent. Rien n'est réécrit, donc
 * ce qu'on teste ici est bien le code de production.
 *
 * Différence assumée : pas de service worker ni d'installation sur l'écran
 * d'accueil — ça exige un déploiement HTTPS à la racine d'un domaine.
 */
import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import { usePathname } from "next/navigation";

import { StoreProvider } from "@/components/Store";
import { Nav } from "@/components/Nav";
import { Disclaimer } from "@/components/Disclaimer";

import HomePage from "@/app/page";
import StaysPage from "@/app/stays/page";
import PlanPage from "@/app/plan/page";
import TimelinePage from "@/app/timeline/page";
import SettingsPage from "@/app/settings/page";
import AboutPage from "@/app/about/page";

// Certains écrans renvoient null tant que le store n'est pas chargé.
const ROUTES: Record<string, () => React.JSX.Element | null> = {
  "/": HomePage,
  "/stays": StaysPage,
  "/plan": PlanPage,
  "/timeline": TimelinePage,
  "/settings": SettingsPage,
  "/about": AboutPage,
};

function App() {
  const pathname = usePathname();
  const Screen = ROUTES[pathname] ?? HomePage;
  return (
    <StoreProvider>
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col">
        <main className="flex-1 px-4 pb-40 pt-5">
          <Screen />
        </main>
        <Disclaimer />
        <Nav />
      </div>
    </StoreProvider>
  );
}

const el = document.getElementById("root");
if (el) {
  createRoot(el).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
