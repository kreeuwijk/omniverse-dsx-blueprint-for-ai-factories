import treemap from "@/assets/treemap.svg";
import { ChartPieInteractive } from "../ui/charts/ChartPieInteractive";

interface KPIWidgetMapperProps {
    kpiName: string;
}

const DoughnutWidget = () => {
    return (
        <ChartPieInteractive />
    );
};


const TreemapWidget = () => {
    return (
        <div>
            <img
                src={treemap}
                alt="TreemapWidget"
                className="w-full rounded-md object-contain"
            />
        </div>
    );
};

const widgetMap: Record<string, React.ComponentType> = {
    "Total Energy Use by Asset": DoughnutWidget,
    "Cost by Subcategory": TreemapWidget,
};

const KPIWidgetMapper = ({ kpiName }: KPIWidgetMapperProps) => {
    const Widget = widgetMap[kpiName];


    if (!Widget) {
        return null;
    }

    return <Widget />;
};

export default KPIWidgetMapper;