import { DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ChartBarDecreasingIcon, ListChecksIcon, EyeIcon, EyeClosed } from "lucide-react";
import { ButtonGroup } from "@/components/ui/button-group";
import { Button } from "@/components/ui/button";
import { Item, ItemContent } from "@/components/ui/item";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import KPISmall from "@/components/metrics/KPISmall";
import SpecificationCard from "@/components/metrics/SpecificationCard";
import { useState } from "react";
import { ConfigRecord } from "@/data/configs";

const ConfigurationModalPanel = (props: ConfigRecord) => {
    const { specSets, kpis, config, location, computePlatform, powerGen } = props;

    const [isVisualized, setVisualized] = useState(false);

    const handleVisualize = () => {
        setVisualized((prev) => !prev);
    };
    
    const handlePropagation = (e: React.MouseEvent<HTMLDivElement>) => {
        e.stopPropagation();
    };

    return (
        <Item onClick={handlePropagation} className="h-[95%] w-full max-w-[620px] bg-panel flex items-center justify-center min-h-0 pointer-events-auto min-w-80">
            <ItemContent className="flex flex-col flex-1 min-h-0 min-w-0 h-full">

                <div className="h-auto box-shadow text-muted-foreground inline-flex h-9 w-full justify-between items-center pl-4">
                    <DialogTitle className="text-xl font-bold text-white">
                        {config}
                    </DialogTitle>

                    <ButtonGroup className="flex items-center">
                        <DialogDescription>Visualize</DialogDescription>
                        <Button
                            className="text-white cursor-pointer"
                            variant="ghost"
                            onClick={handleVisualize}
                            aria-label="Toggle visualization"
                        >
                            {isVisualized ? <EyeIcon /> : <EyeClosed />}
                        </Button>
                    </ButtonGroup>
                </div>

                <div className="flex flex-col gap-2 py-2 pl-4">
                    <DialogDescription>Location: {location}</DialogDescription>
                    <DialogDescription>Compute Platform: {computePlatform}</DialogDescription>
                    <DialogDescription>Power Generation: {powerGen}</DialogDescription>
                </div>

                <Tabs defaultValue="specs" className="flex flex-col flex-1 min-h-0">
                    <div className="inline-flex gap-4 justify-between shrink-0 px-2 py-2">
                        <TabsList className="w-full">
                            <TabsTrigger value="specs">
                                <ListChecksIcon /> Specifications
                            </TabsTrigger>
                            <TabsTrigger value="kpis">
                                <ChartBarDecreasingIcon /> KPIs
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <Separator className="my-2 shrink-0" />

                    <div className="flex-1 min-h-0 min-w-0 overflow-y-auto scrollable pl-2 pr-5 pb-2">
                        <TabsContent value="specs" className="h-full">
                            <div className="flex flex-col gap-4 pb-8">
                                {specSets?.length > 0 &&
                                    specSets.map((set) => (
                                        <SpecificationCard key={set.title} specs={set.specs} title={set.title} />
                                    ))}
                            </div>
                        </TabsContent>

                        <TabsContent value="kpis" className="h-full">
                            <div className="flex flex-col gap-4 pb-5">
                                {kpis?.length > 0 &&
                                    kpis.map((kpi) => <KPISmall key={kpi.name} kpi={kpi} />)}
                            </div>
                        </TabsContent>
                    </div>
                </Tabs>
            </ItemContent>
        </Item>
    );
};

export default ConfigurationModalPanel;
