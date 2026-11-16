import { useState } from "react";
import { B1ServicePayload, B1ServiceSong, UserConfig } from "../types";
import { splitIntoSectionBlocks } from "../utils/music";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  CalendarDays,
  Search,
  Music,
  ChevronRight,
  Clock,
  Check,
  History,
} from "lucide-react";

interface Props {
  service: B1ServicePayload;
  config: UserConfig;
  onSelectSong: (song: B1ServiceSong) => void;
  onSelectPlan: (planId: string) => void;
}

export default function ServiceView({
  service,
  config,
  onSelectSong,
  onSelectPlan,
}: Props) {
  const [showServicePicker, setShowServicePicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredPlans = service.all_plans.filter((p) => {
    const label = `${p.name} ${p.service_date || ""}`.toLowerCase();
    return label.includes(searchQuery.toLowerCase());
  });

  const formattedDate = service.active_plan.service_date
    ? service.active_plan.service_date.slice(0, 10)
    : "Upcoming Service";

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 md:p-8 space-y-5">
      {/* Service Hero Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1.5 font-mono text-xs">
              <CalendarDays className="size-4 lg:size-3.5" />
              {formattedDate}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {service.songs.length} Songs Imported
            </Badge>
          </div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight mt-1">
            {service.active_plan.name}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Click any song below to open its live chord sheet in{" "}
            <span className="font-medium text-foreground capitalize">
              {config.notation}
            </span>{" "}
            format.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <Button
            variant={showServicePicker ? "secondary" : "outline"}
            onClick={() => setShowServicePicker(!showServicePicker)}
            className="gap-2 h-10 lg:h-9"
          >
            <History className="size-5 lg:size-4" />
            {showServicePicker ? "Close Service Archive" : "Switch Service"}
          </Button>
          {service.songs.length > 0 && (
            <Button
              onClick={() => onSelectSong(service.songs[0])}
              className="gap-1.5 h-10 lg:h-9"
            >
              Start Setlist
              <ChevronRight className="size-5 lg:size-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Collapsible Service Archive Drawer */}
      {showServicePicker && (
        <Card className="border-primary/30 bg-muted/30">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Browse Service Plans</CardTitle>
                <CardDescription>
                  Ordered chronologically from most recent to oldest
                </CardDescription>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by service name or date..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1">
              {filteredPlans.map((plan) => {
                const isActive = plan.id === service.active_plan.id;
                return (
                  <button
                    key={plan.id}
                    onClick={() => {
                      onSelectPlan(plan.id);
                      setShowServicePicker(false);
                    }}
                    className={`flex items-center justify-between p-3 rounded-lg border text-left transition-all ${
                      isActive
                        ? "border-primary bg-primary/10 font-medium"
                        : "border-border bg-card hover:bg-accent/60"
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-mono text-muted-foreground">
                        {plan.service_date
                          ? plan.service_date.slice(0, 10)
                          : "No Date"}
                      </p>
                      <p className="text-sm truncate font-medium mt-0.5">
                        {plan.name}
                      </p>
                    </div>
                    {isActive && (
                      <Check className="size-4 text-primary shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Setlist Song Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {service.songs.map((song, idx) => {
          const blocks = splitIntoSectionBlocks(
            song.raw_chordpro,
            config.sectionKeywords
          );
          const sectionHeaders = blocks
            .map((b) => b.header?.replace(/^\[|\]$/g, ""))
            .filter(Boolean)
            .slice(0, 5);

          return (
            <Card
              key={song.plan_item_id}
              onClick={() => onSelectSong(song)}
              className="group cursor-pointer transition-all hover:border-primary/50 hover:shadow-md"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary font-mono text-sm font-bold">
                      {String(idx + 1).padStart(2, "0")}
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-base group-hover:text-primary transition-colors truncate">
                        {song.title}
                      </CardTitle>
                      <CardDescription className="truncate">
                        {song.artist || "Worship Song"}
                      </CardDescription>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {song.key_signature ? (
                      <Badge className="font-mono text-xs px-2 py-0.5">
                        Key: {song.key_signature}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="font-mono text-[11px]">
                        Nashville Only
                      </Badge>
                    )}
                    {song.bpm && (
                      <Badge variant="secondary" className="font-mono text-xs gap-1">
                        <Clock className="size-3" />
                        {song.bpm}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-0 flex items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1">
                  {sectionHeaders.length > 0 ? (
                    sectionHeaders.map((sec, i) => (
                      <span
                        key={i}
                        className="text-[11px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-medium"
                      >
                        {sec}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Music className="size-3.5" /> Ready to view
                    </span>
                  )}
                </div>

                <ChevronRight className="size-5 lg:size-4 text-muted-foreground group-hover:translate-x-0.5 group-hover:text-primary transition-transform shrink-0" />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}