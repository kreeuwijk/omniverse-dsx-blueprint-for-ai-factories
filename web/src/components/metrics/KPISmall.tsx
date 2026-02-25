// This component displays a small KPI card with an icon, name, value, description, and a circular score indicator.

import {
    Card,
    CardContent
} from "@/components/ui/card"
import { KPI } from "@/data/kpis";
import { CircularScore } from "./CircularScore";
import SvgIcon from "@/components/metrics/icons/SvgIcon";
import KPICardModal from "./KPICardModal";
import KPIWidgetMapper from "./KPIWidget";

const formatCurrency = (value: number) => `$${value.toLocaleString('en-US')}`;
const kpiValueMapper = (value: number, unit?: string) => {
    switch (unit) {
        case "$":
            return formatCurrency(value);
        case "MWh":
            return null;
        default:
            return <>{value} {unit && <span> {unit}</span>}</>
    }
};

interface ChildProps {
    kpi: KPI;
}

const KPISmall = ({ kpi }: ChildProps) => {
    const bgColor = kpi.score > 90 ? "kpi-card-green" : kpi.score > 70 ? "kpi-card-yellow" : "kpi-card-red";

    return (
        <div>
            <Card className={`${bgColor} backdrop-blur-large`}>
                <CardContent className="flex justify-between relative">
                    <div className="flex gap-2 flex-col w-full">
                        <SvgIcon name={kpi.icon} height={35} width={35} />
                        <div className="text-base font-bold">{kpi.name}</div>
                        <div className="text-xl font-bold py-2">
                            {kpiValueMapper(kpi.value, kpi.unit)}
                        </div>
                        <div className="text-xs font-light">{kpi.description}</div>
                        <KPIWidgetMapper kpiName={kpi.name} />
                    </div>

                    <div className="flex flex-col gap-5">
                        <CircularScore size={50} value={kpi.score} />

                        <KPICardModal kpi={kpi} />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default KPISmall;
