import { ChartColumnIncreasingIcon, ChartBarDecreasingIcon, SlidersHorizontalIcon, ListChecksIcon } from "lucide-react";
import { Item, ItemContent } from "@/components/ui/item";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ButtonGroup } from "@/components/ui/button-group";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import KPISmall from "@/components/metrics/KPISmall";
import SpecificationCard from "@/components/metrics/SpecificationCard";
import { getData, getSiteData, KPI_CHARTS } from "@/data/kpis";
import { useConfig } from "@/context/DS9Context";
import { useUI } from "@/context/UIContext";

const AnalyticsPanel = () => {
    const { selectedGpu, selectedSite } = useConfig();
    const { state } = useUI();

    if (!selectedGpu || !selectedSite) {
        return null;
    }

    // Get data by selected GPU
    const data = getData(selectedGpu);
    const kpis = data.kpis;
    const specSets = data.specSets

    // Get data for selected Site
    const siteData = getSiteData(selectedSite);

    return (
        <Item className="w-full h-full bg-panel flex flex-row flex-1 items-start min-h-0 pointer-events-auto">
            <div className="p-3 bg-panel-title rounded-lg flex flex-col items-center justify-start shrink-0">
                <ChartColumnIncreasingIcon />
                <span className="text-lg text-white font-semibold tracking-wide [writing-mode:vertical-rl] rotate-180 mx-2">
                    Analytics
                </span>
            </div>
            <ItemContent className="flex flex-col flex-1 min-h-0 min-w-0 h-full">
                <Tabs defaultValue="specs" className="flex flex-col flex-1 min-h-0">
                    <div className="inline-flex gap-4 justify-between shrink-0 px-2 py-1">
                        <TabsList className="w-full">
                            <TabsTrigger value="specs"><ListChecksIcon /> Specifications</TabsTrigger>
                            <TabsTrigger value="kpis"><ChartBarDecreasingIcon /> KPIs</TabsTrigger>
                        </TabsList>
                        <ButtonGroup>
                            <Button disabled variant={"ghost"}><SlidersHorizontalIcon /></Button>
                        </ButtonGroup>
                    </div>
                    <Separator className="my-2 shrink-0" />
                    <div className="flex-1 min-h-0 min-w-0 overflow-y-auto scrollable pl-2 pr-5 pb-2">
                        <TabsContent value="specs" className="h-full">
                            <div className="flex flex-col gap-4 pb-8">
                                {state.activeConfigMode === "gpu" && specSets.length > 0 && specSets.map((set) => (
                                    <SpecificationCard key={set.title} specs={set.specs} title={set.title} />
                                ))}
                                {state.activeConfigMode === "site" && siteData &&
                                <SpecificationCard key="site-specs" specs={siteData.specs} title={`Site X, ${siteData.title}`}/>
                                }
                            </div>
                        </TabsContent>
                        <TabsContent value="kpis" className="h-full">
                            <div className="flex flex-col gap-4 pb-5">
                                {kpis.length > 0 && kpis.map((kpi) => (
                                    <KPISmall key={kpi.name} kpi={kpi} />
                                ))}
                                {KPI_CHARTS.map((kpi) => (
                                    <KPISmall key={kpi.name} kpi={kpi} />
                                ))}
                            </div>
                        </TabsContent>
                    </div>
                </Tabs>
            </ItemContent>
        </Item>
    )
}

export default AnalyticsPanel;