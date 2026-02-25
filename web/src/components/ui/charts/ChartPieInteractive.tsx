import { Label, Pie, PieChart, ResponsiveContainer, Sector } from "recharts"
import { type PieSectorDataItem } from "recharts/types/polar/Pie"
import {
    ChartContainer,
    ChartStyle,
    ChartTooltip,
    ChartTooltipContent,
} from "@/components/ui/chart"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { useMemo, useState } from "react"

const desktopData = [
    { month: "option1", desktop: 186, fill: "var(--pie-chart-1)" },
    { month: "option2", desktop: 305, fill: "var(--pie-chart-2)" },
    { month: "option3", desktop: 237, fill: "var(--pie-chart-3)" },
    { month: "option4", desktop: 173, fill: "var(--pie-chart-4)" },
    { month: "option5", desktop: 209, fill: "var(--pie-chart-5)" },
]

const chartConfig = {
    option1: { label: "Chillers", color: "var(--pie-chart-1)" },
    option2: { label: "Chillers 2", color: "var(--pie-chart-2)" },
    option3: { label: "Chillers 3", color: "var(--pie-chart-3)" },
    option4: { label: "Chillers 4", color: "var(--pie-chart-4)" },
    option5: { label: "Chillers 5", color: "var(--pie-chart-5)" },
}

export function ChartPieInteractive() {
    const id = "pie-interactive";
    const [activeOption, setActiveOption] = useState(desktopData[0].month);

    const activeIndex = useMemo(
        () => desktopData.findIndex((item) => item.month === activeOption),
        [activeOption]
    );
    const options = useMemo(() => desktopData.map((item) => item.month), []);

    return (
        <div className="flex flex-col gap-3">
            <ChartStyle id={id} config={chartConfig} />

            <div className="flex items-start justify-between w-full max-w-[275px]">
                <Select value={activeOption} onValueChange={setActiveOption}>
                    <SelectTrigger
                        className="h-7 w-[130px] rounded-lg pl-2.5"
                        aria-label="Select a value"
                    >
                        <SelectValue placeholder="Select option" />
                    </SelectTrigger>
                    <SelectContent align="start" className="rounded-xl">
                        {options.map((key) => {
                            const config = chartConfig[key as keyof typeof chartConfig];
                            if (!config) {
                                return null;
                            }
                            
                            return (
                                <SelectItem key={key} value={key} className="rounded-lg [&_span]:flex">
                                    <div className="flex items-center gap-2 text-xs">
                                        <span
                                            className="flex h-3 w-3 shrink-0 rounded-xs"
                                            style={{ backgroundColor: `var(--color-${key})` }}
                                        />
                                        {config?.label}
                                    </div>
                                </SelectItem>
                            );
                        })}
                    </SelectContent>
                </Select>
            </div>

            <div className="flex justify-center">
                <ChartContainer
                    id={id}
                    config={chartConfig}
                    className="mx-auto aspect-square w-full max-w-[275px]"
                >
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                            <Pie
                                data={desktopData}
                                dataKey="desktop"
                                nameKey="month"
                                innerRadius="45%" 
                                strokeWidth={5}
                                activeIndex={activeIndex}
                                activeShape={({ outerRadius = 0, ...props }: PieSectorDataItem) => (
                                    <g>
                                        <Sector {...props} outerRadius={+outerRadius + 10} />
                                        <Sector
                                            {...props}
                                            outerRadius={+outerRadius + 25}
                                            innerRadius={+outerRadius + 12}
                                        />
                                    </g>
                                )}
                            >
                                <Label
                                    content={({ viewBox }) => {
                                        if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                                            return (
                                                <text
                                                    x={viewBox.cx}
                                                    y={viewBox.cy}
                                                    textAnchor="middle"
                                                    dominantBaseline="middle"
                                                >
                                                    <tspan
                                                        x={viewBox.cx}
                                                        y={viewBox.cy}
                                                        className="fill-foreground font-bold"
                                                        style={{ fontSize: "clamp(1rem, 4vw, 1.25rem)" }}
                                                    >
                                                        {desktopData[activeIndex].desktop.toLocaleString()}
                                                    </tspan>
                                                    <tspan
                                                        x={viewBox.cx}
                                                        y={(viewBox.cy || 0) + 20}
                                                        className="fill-muted-foreground"
                                                        style={{ fontSize: "clamp(0.75rem, 2.5vw, 0.95rem)" }}
                                                    >
                                                        Energy MWh
                                                    </tspan>
                                                </text>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                            </Pie>
                        </PieChart>
                    </ResponsiveContainer>
                </ChartContainer>
            </div>
        </div>
    )
}
