import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { B1ServicePayload, B1ServiceSong, UserConfig } from "./types";
import AppSidebar, { ActiveTab } from "./components/AppSidebar";
import ServiceView from "./components/ServiceView";
import SongView from "./components/SongView";
import ConfigView from "./components/ConfigView";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";

const DEFAULT_CONFIG: UserConfig = {
  notation: "nashville",
  layout: "blocks",
  columnCount: 2,
  darkMode: true,
  zoom: 16,
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
  ],
};

export default function App() {
  const [service, setService] = useState<B1ServicePayload | null>(null);
  const [selectedSong, setSelectedSong] = useState<B1ServiceSong | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("service");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [config, setConfig] = useState<UserConfig>(() => {
    const saved = localStorage.getItem("b1_user_config");
    return saved ? { ...DEFAULT_CONFIG, ...JSON.parse(saved) } : DEFAULT_CONFIG;
  });

  // Sync Tailwind .dark class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (config.darkMode) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [config.darkMode]);

  // Cmd + B shortcut to collapse/expand the sidebar
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

  async function loadService(planId: string | null = null) {
    setLoading(true);
    setErr("");
    try {
      const data = await invoke<B1ServicePayload>("fetch_service_view", { planId });
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
      <div className="flex flex-col items-center justify-center h-screen bg-background text-foreground gap-3">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground font-medium">
          Syncing service plans & charts from B1.church...
        </p>
      </div>
    );
  }

  if (err || !service) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background text-foreground p-6 text-center gap-4">
        <p className="text-sm text-destructive font-mono max-w-md">{err}</p>
        <Button onClick={() => loadService(null)} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Retry Connection
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground relative">
      {/* Mobile Backdrop Overlay (Phones only) */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-xs md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <div
        className={`fixed inset-y-0 left-0 z-40 flex md:static md:z-auto transition-transform duration-200 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
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

      {/* Active View Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top bar for Service & Config views on small phone screens */}
        {activeTab !== "song" && (
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border md:hidden">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMobileMenuOpen(true)}
            >
              ☰ Menu / Setlist
            </Button>
            <span className="text-xs font-semibold truncate">
              {service.active_plan.name}
            </span>
          </div>
        )}

        {activeTab === "config" && (
          <ConfigView config={config} onChangeConfig={handleUpdateConfig} />
        )}

        {activeTab === "song" && selectedSong && (
          <SongView
            song={selectedSong}
            allSongsInService={service.songs}
            config={config}
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