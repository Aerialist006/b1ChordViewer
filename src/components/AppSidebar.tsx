import { B1ServicePayload, B1ServiceSong, UserConfig } from "../types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Calendar,
  Music2,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  Moon,
  Disc3,
} from "lucide-react";

export type ActiveTab = "service" | "song" | "config";

interface Props {
  service: B1ServicePayload;
  selectedSong: B1ServiceSong | null;
  activeTab: ActiveTab;
  collapsed: boolean;
  config: UserConfig;
  onToggleCollapse: () => void;
  onSelectTab: (tab: ActiveTab) => void;
  onSelectSong: (song: B1ServiceSong) => void;
  onToggleDark: () => void;
}

export default function AppSidebar({
  service,
  selectedSong,
  activeTab,
  collapsed,
  config,
  onToggleCollapse,
  onSelectTab,
  onSelectSong,
  onToggleDark,
}: Props) {
  return (
    <aside
      className={`flex flex-col h-full border-r border-border bg-card/95 md:bg-card/60 backdrop-blur-md transition-all duration-200 select-none shrink-0 ${
        collapsed ? "w-16" : "w-64 lg:w-68"
      }`}
    >
      {/* App Brand Header — Exact h-14 to align with SongView top bar */}
      <div className="flex items-center justify-between h-14 px-3 border-b border-border shrink-0">
        {!collapsed && (
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
              <Disc3 className="size-5 lg:size-4" />
            </div>
            <div className="truncate">
              <p className="text-sm font-semibold leading-none tracking-tight">
                B1 Worship
              </p>
              <p className="text-[11px] text-muted-foreground truncate mt-1">
                {service.active_plan.name}
              </p>
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleCollapse}
          title="Toggle Sidebar (Cmd+B)"
          className="size-9 lg:size-8 shrink-0 ml-auto"
        >
          {collapsed ? (
            <PanelLeftOpen className="size-5 lg:size-4" />
          ) : (
            <PanelLeftClose className="size-5 lg:size-4" />
          )}
        </Button>
      </div>

      {/* Primary Navigation */}
      <div className="p-2 space-y-1">
        <Button
          variant={activeTab === "service" ? "secondary" : "ghost"}
          className={`w-full h-10 lg:h-9 text-sm ${
            collapsed ? "justify-center px-0" : "justify-start gap-2.5"
          }`}
          onClick={() => onSelectTab("service")}
        >
          <Calendar className="size-5 lg:size-4 shrink-0" />
          {!collapsed && <span>Service Overview</span>}
        </Button>

        <Button
          variant={activeTab === "config" ? "secondary" : "ghost"}
          className={`w-full h-10 lg:h-9 text-sm ${
            collapsed ? "justify-center px-0" : "justify-start gap-2.5"
          }`}
          onClick={() => onSelectTab("config")}
        >
          <Settings className="size-5 lg:size-4 shrink-0" />
          {!collapsed && <span>Studio Settings</span>}
        </Button>
      </div>

      <Separator />

      {/* Live Service Setlist */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {!collapsed && (
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Service Setlist
            </span>
            <Badge variant="outline" className="text-[10px] h-4 px-1.5">
              {service.songs.length}
            </Badge>
          </div>
        )}

        {service.songs.map((song, idx) => {
          const isSelected =
            activeTab === "song" && selectedSong?.plan_item_id === song.plan_item_id;
          return (
            <button
              key={song.plan_item_id}
              onClick={() => onSelectSong(song)}
              title={`${idx + 1}. ${song.title} (${song.key_signature || "Nashville"})`}
              className={`group flex items-center w-full rounded-lg text-left transition-colors ${
                collapsed
                  ? "justify-center py-2.5 px-0"
                  : "justify-between px-2.5 py-2 gap-2"
              } ${
                isSelected
                  ? "bg-primary text-primary-foreground font-medium shadow-xs"
                  : "hover:bg-accent text-foreground/85 hover:text-foreground"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className={`flex size-5 shrink-0 items-center justify-center rounded text-[11px] font-mono ${
                    isSelected
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {idx + 1}
                </span>
                {!collapsed && (
                  <div className="truncate">
                    <p className="text-xs font-medium truncate leading-tight">
                      {song.title}
                    </p>
                    {song.artist && (
                      <p
                        className={`text-[10px] truncate mt-0.5 ${
                          isSelected
                            ? "text-primary-foreground/75"
                            : "text-muted-foreground"
                        }`}
                      >
                        {song.artist}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {!collapsed && (
                <Badge
                  variant={isSelected ? "secondary" : "outline"}
                  className="shrink-0 font-mono text-[10px] px-1.5 py-0 h-5"
                >
                  {song.key_signature || "NNS"}
                </Badge>
              )}
            </button>
          );
        })}
      </div>

      <Separator />

      {/* Footer: Notation Indicator + Theme Toggle */}
      <div className="p-2 flex items-center justify-between gap-2 shrink-0">
        {!collapsed && (
          <div className="flex items-center gap-2 px-2 text-xs text-muted-foreground">
            <Music2 className="size-4 shrink-0" />
            <span className="capitalize">{config.notation}</span>
            <span>·</span>
            <span className="capitalize">{config.layout}</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleDark}
          className={`size-9 lg:size-8 ${collapsed ? "mx-auto" : "ml-auto"}`}
          title="Toggle Dark/Light Theme"
        >
          {config.darkMode ? (
            <Sun className="size-5 lg:size-4" />
          ) : (
            <Moon className="size-5 lg:size-4" />
          )}
        </Button>
      </div>
    </aside>
  );
}