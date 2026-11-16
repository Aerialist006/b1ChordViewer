import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  B1ServicePayload,
  B1ServiceSong,
  PASTEL_PRESETS,
  UserConfig,
} from "./types";
import AppSidebar, { ActiveTab } from "./components/AppSidebar";
import ServiceView from "./components/ServiceView";
import SongView from "./components/SongView";
import ConfigView from "./components/ConfigView";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { KeyRound, Loader2, RefreshCw, Settings, Menu } from "lucide-react";

const DEFAULT_CONFIG: UserConfig = {
  apiKey: "",
  notation: "nashville",
  layout: "blocks",
  columnCount: 2,
  darkMode: true,
  zoom: 16,
  accentColor: "lavender",
  chordColor: "peach",
  sectionKeywords: [
    "Verso",
    "Coro",
    "Pre-Coro",
    "Puente",
    "Intro",
    "Outro",
    "Final",
    "Instrumental",
    "Tag",
    "MYM",
  ],
};

export default function App() {
  const [service, setService] = useState<B1ServicePayload | null>(null);
  const [selectedSong, setSelectedSong] = useState<B1ServiceSong | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("service");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [isFullScreen, setIsFullScreen] = useState(false);

  const [config, setConfig] = useState<UserConfig>(() => {
    const saved = localStorage.getItem("b1_user_config");
    return saved ? { ...DEFAULT_CONFIG, ...JSON.parse(saved) } : DEFAULT_CONFIG;
  });

  const [onboardingKey, setOnboardingKey] = useState(config.apiKey || "");

  useEffect(() => {
    const root = document.documentElement;
    if (config.darkMode) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    const accentPreset =
      PASTEL_PRESETS.find((p) => p.id === config.accentColor) || PASTEL_PRESETS[0];
    const chordPreset =
      PASTEL_PRESETS.find((p) => p.id === config.chordColor) || PASTEL_PRESETS[2];

    const activeAccentHex = config.darkMode
      ? accentPreset.swatch
      : accentPreset.lightHex;
    const activeAccentFg = config.darkMode ? accentPreset.fgOnDark : "#ffffff";
    const activeChordHex = config.darkMode
      ? chordPreset.swatch
      : chordPreset.lightHex;

    root.style.setProperty("--primary", activeAccentHex);
    root.style.setProperty("--ring", activeAccentHex);
    root.style.setProperty("--primary-foreground", activeAccentFg);
    root.style.setProperty("--chord-color", activeChordHex);
  }, [config.darkMode, config.accentColor, config.chordColor]);

  // Reset scroll offset and close mobile drawer on device rotation (portrait <-> landscape)
  useEffect(() => {
    function handleOrientationOrResize() {
      window.scrollTo(0, 0);
      if (window.innerWidth >= 768) {
        setMobileMenuOpen(false);
      }
    }
    window.addEventListener("resize", handleOrientationOrResize);
    window.addEventListener("orientationchange", handleOrientationOrResize);
    return () => {
      window.removeEventListener("resize", handleOrientationOrResize);
      window.removeEventListener("orientationchange", handleOrientationOrResize);
    };
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setSidebarCollapsed((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  function handleUpdateConfig(next: UserConfig) {
    setConfig(next);
    localStorage.setItem("b1_user_config", JSON.stringify(next));
  }

  async function loadService(
    planId: string | null = null,
    overrideApiKey?: string
  ) {
    setLoading(true);
    setErr("");
    const tokenToUse =
      overrideApiKey !== undefined ? overrideApiKey : config.apiKey;
    try {
      const data = await invoke<B1ServicePayload>("fetch_service_view", {
        planId,
        apiToken: tokenToUse || null,
      });
      setService(data);
      setSelectedSong(data.songs[0] || null);
      setActiveTab("service");
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadService(null);
  }, []);

  if (loading) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-background text-foreground gap-3">
        <Loader2 className="size-7 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground font-medium">
          Syncing service plans & charts from B1.church...
        </p>
      </div>
    );
  }

  if (err || !service) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-background text-foreground p-4 overflow-y-auto">
        <Card className="w-full max-w-md shadow-md">
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <KeyRound className="size-5 text-primary shrink-0" />
              <CardTitle className="text-lg">Connect Your Church B1 API</CardTitle>
            </div>
            <CardDescription>
              Enter your ChurchApps (B1.church) API Key to load your worship plans and chord charts.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {err && (
              <p className="text-xs text-destructive font-mono bg-destructive/10 p-2.5 rounded-lg">
                {err}
              </p>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const cleaned = onboardingKey.trim();
                handleUpdateConfig({ ...config, apiKey: cleaned });
                loadService(null, cleaned);
              }}
              className="space-y-3"
            >
              <Input
                type="password"
                placeholder="cak_your_church_api_key_here..."
                value={onboardingKey}
                onChange={(e) => setOnboardingKey(e.target.value)}
                className="font-mono text-xs h-10"
              />
              <Button type="submit" className="w-full h-10 gap-2">
                <RefreshCw className="size-4" />
                Save Key & Connect
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  const hideChrome = isFullScreen && activeTab === "song";

  return (
    <div
      className="fixed inset-0 flex overflow-hidden bg-background text-foreground"
      style={{
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        paddingLeft: "env(safe-area-inset-left, 0px)",
        paddingRight: "env(safe-area-inset-right, 0px)",
      }}
    >
      {/* Mobile Backdrop Overlay */}
      {!hideChrome && mobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-xs md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      {!hideChrome && (
        <div
          className={`fixed inset-y-0 left-0 z-40 flex md:static md:z-auto transition-transform duration-200 ${
            mobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          }`}
          style={{
            paddingTop: "env(safe-area-inset-top, 0px)",
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
            paddingLeft: "env(safe-area-inset-left, 0px)",
          }}
        >
          <AppSidebar
            service={service}
            selectedSong={selectedSong}
            activeTab={activeTab}
            collapsed={sidebarCollapsed}
            config={config}
            onToggleCollapse={() => {
              if (window.innerWidth < 768) {
                setMobileMenuOpen(false);
              } else {
                setSidebarCollapsed(!sidebarCollapsed);
              }
            }}
            onSelectTab={(tab) => {
              setActiveTab(tab);
              setMobileMenuOpen(false);
            }}
            onSelectSong={(song) => {
              setSelectedSong(song);
              setActiveTab("song");
              setMobileMenuOpen(false);
            }}
            onToggleDark={() =>
              handleUpdateConfig({ ...config, darkMode: !config.darkMode })
            }
          />
        </div>
      )}

      {/* Active View Area */}
      <main className="flex-1 flex flex-col min-w-0 min-h-0 overflow-y-auto">
        {!hideChrome && activeTab !== "song" && (
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border min-h-14 md:hidden bg-background/90 backdrop-blur-md sticky top-0 z-20">
            <div className="flex items-center gap-2.5 min-w-0">
              <Button
                variant="outline"
                size="icon"
                className="size-10 shrink-0"
                onClick={() => setMobileMenuOpen(true)}
                title="Open Menu & Setlist"
              >
                <Menu className="size-5" />
              </Button>
              <span className="text-base font-bold truncate">
                {activeTab === "config" ? "Studio Settings" : service.active_plan.name}
              </span>
            </div>

            <Button
              variant={activeTab === "config" ? "secondary" : "ghost"}
              size="icon"
              className="size-10 shrink-0"
              onClick={() =>
                setActiveTab(activeTab === "config" ? "service" : "config")
              }
              title="Toggle Settings"
            >
              <Settings className="size-5" />
            </Button>
          </div>
        )}

        {activeTab === "config" && (
          <ConfigView
            config={config}
            onChangeConfig={handleUpdateConfig}
            onSaveApiKeyAndSync={(newKey) => {
              handleUpdateConfig({ ...config, apiKey: newKey });
              loadService(null, newKey);
            }}
          />
        )}

        {activeTab === "song" && selectedSong && (
          <SongView
            song={selectedSong}
            allSongsInService={service.songs}
            config={config}
            isFullScreen={isFullScreen}
            onToggleFullScreen={(next) =>
              setIsFullScreen(next !== undefined ? next : !isFullScreen)
            }
            onChangeConfig={handleUpdateConfig}
            onSelectSong={(s) => setSelectedSong(s)}
            onOpenMobileSidebar={() => setMobileMenuOpen(true)}
          />
        )}

        {(activeTab === "service" || (activeTab === "song" && !selectedSong)) && (
          <ServiceView
            service={service}
            config={config}
            onSelectSong={(song) => {
              setSelectedSong(song);
              setActiveTab("song");
            }}
            onSelectPlan={(planId) => loadService(planId)}
          />
        )}
      </main>
    </div>
  );
}