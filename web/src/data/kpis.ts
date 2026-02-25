// This file contains all the pre-set KPI and specification data for different GPU configurations.
import { IconName } from "@/components/metrics/icons/SvgIcon";

export type KPI = {
    name: string;
    description: string;
    value: number;
    unit?: string;
    score: number;
    icon: IconName;
}

export type Specification = {
    name: string;
    description: string;
}

export type SpecificationSet = {
    title: string;
    specs: Specification[]
}

type KPIData = {
    gpu: string;
    kpis: KPI[];
    specSets: SpecificationSet[];
}

export const KPI_CHARTS: KPI[] = [
    { name: "Cost by Subcategory", description: "", value: 7401791000, unit: "$", score: 97, icon: "COST" },
    { name: "Total Energy Use by Asset", description: "", value: 186, unit: "MWh", score: 99, icon: "POWER" },
];

const SITE_DATA: SpecificationSet[] = [
    {
        title: "Sweden",
        specs: [
            { name: "Power Capacity", description: "1-gigawatt (GW) capacity. Dedicated, on-site electrical substation with direct, high-voltage connection to the grid." },
            { name: "Land Area", description: "1,200 acres." },
            { name: "Water Supply", description: "Site has a reliable water source from city water system." },
            { name: "Building Size", description: "2,000,000 sq ft." },
            { name: "Internal Architecture", description: "800V DC power distribution and new Open Compute Project (OCP) standards for power and cooling." },
            { name: "Permits", description: "The location is already zoned for industrial use." },
            { name: "Connectivity", description: "The site has access to high-speed, high-capacity fiber optic network infrastructure for the necessary data transmission needs." },
        ]
    },
    {
        title: "New Mexico",
        specs: [
            { name: "Power Capacity", description: "1-gigawatt (GW) capacity. Dedicated, on-site electrical substation with direct, high-voltage connection to the grid." },
            { name: "Land Area", description: "1,200 acres." },
            { name: "Water Supply", description: "Site has a reliable water source from city water system." },
            { name: "Building Size", description: "2,000,000 sq ft." },
            { name: "Internal Architecture", description: "800V DC power distribution and new Open Compute Project (OCP) standards for power and cooling." },
            { name: "Permits", description: "The location is already zoned for industrial use." },
            { name: "Connectivity", description: "The site has access to high-speed, high-capacity fiber optic network infrastructure for the necessary data transmission needs." },
        ]
    },
    {
        title: "Virginia",
        specs: [
            { name: "Power Capacity", description: "1-gigawatt (GW) capacity. Dedicated, on-site electrical substation with direct, high-voltage connection to the grid." },
            { name: "Land Area", description: "1,200 acres." },
            { name: "Water Supply", description: "Site has a reliable water source from city water system." },
            { name: "Building Size", description: "2,000,000 sq ft." },
            { name: "Internal Architecture", description: "800V DC power distribution and new Open Compute Project (OCP) standards for power and cooling." },
            { name: "Permits", description: "The location is already zoned for industrial use." },
            { name: "Connectivity", description: "The site has access to high-speed, high-capacity fiber optic network infrastructure for the necessary data transmission needs." },
        ]
    },

]

const KPI_DATA: KPIData[] = [
    {
        gpu: "NVIDIA GB300",
        kpis: [
            { name: "Token Efficiency", description: "Total Facility Power / Tokens generated", value: 0.0003, unit: "kWh / token", score: 95, icon: "TE" },
            { name: "Power Usage Effectiveness (PUE)", description: "Total Facility Power / IT Power", value: 1.2, unit: "ratio", score: 85, icon: "PUE" },
            { name: "Water Usage Effectiveness (WUE)", description: "Total Water usage / IT Power", value: 1.5, unit: "m³/MWh", score: 85, icon: "WUE" },
            { name: "Carbon Usage Effectiveness (CUE)", description: "Total Carbon Emissions / IT Power", value: 0.05, unit: "Kg/kWh", score: 65, icon: "CUE" },
        ],
        specSets: [
            {
                title: "NVIDIA GB300 NVL72",
                specs: [
                    { name: "Configuration", description: "72 NVIDIA Blackwell Ultra GPUs, 36 NVIDIA Grace CPUs" },
                    { name: "NVLink Bandwidth", description: "130 TB/s" },
                    { name: "Fast Memory", description: "37 TB" },
                    { name: "GPU Memory | Bandwidth", description: "20 TB | Up to 576 TB/s" },
                    { name: "CPU Memory | Bandwidth", description: "17 TB LPDDR5X | 14 TB/s" },
                    { name: "CPU Core Count", description: "2,592 Arm Neoverse V2 cores" },
                    { name: "FP4 Tensor Core", description: "1440 | 1080² PFLOPS" },
                    { name: "FP8/FP6 Tensor Core", description: "720 PFLOPS" },
                    { name: "INT8 Tensor Core", description: "24 POPS" },
                    { name: "FP16/BF Tensor Core", description: "360 PFLOPS" },
                    { name: "TF32 Tensor Core", description: "180 PFLOPS" },
                    { name: "FP32", description: "6 PFLOPS" },
                    { name: "FP64 / FP64 Tensor Core", description: "100 TFLOPS" }
                ]
            },
            {
                title: "Building",
                specs: [
                    { name: "Building Height", description: "22m" },
                    { name: "Building Perimeter", description: "280m" },
                    { name: "Floor Area", description: "12,000m²" },
                    { name: "Footprint Area", description: "6,000m²" },
                    { name: "Roof Area", description: "6,200m²" },
                    { name: "Cladding Area", description: "8,000m²" },
                    { name: "Building Volume", description: "150,000m³" },
                    { name: "Rack Conditioning Area", description: "4,500m²" },
                    { name: "Compute to Leaf", description: "0.3ms" },
                    { name: "Leaf to Core", description: "0.6ms" }
                ]
            }
        ]
    },
    {
        gpu: "NVIDIA GB200",
        kpis: [
            { name: "Token Efficiency", description: "Total Facility Power / Tokens generated", value: 0.0003, unit: "kWh / token", score: 65, icon: "TE" },
            { name: "Power Usage Effectiveness (PUE)", description: "Total Facility Power / IT Power", value: 1.2, unit: "ratio", score: 95, icon: "PUE" },
            { name: "Water Usage Effectiveness (WUE)", description: "Total Water usage / IT Power", value: 1.5, unit: "m³/MWh", score: 55, icon: "WUE" },
            { name: "Carbon Usage Effectiveness (CUE)", description: "Total Carbon Emissions / IT Power", value: 0.05, unit: "Kg/kWh", score: 75, icon: "CUE" },
        ],
        specSets: [
            {
                title: "NVIDIA GB200 NVL72",
                specs: [
                    { name: "Configuration", description: "36 Grace CPU : 72 Blackwell GPUs" },
                    { name: "FP4 Tensor Core", description: "1,440 PFLOPS" },
                    { name: "FP8/FP6 Tensor Core", description: "720 PFLOPS" },
                    { name: "INT8 Tensor Core", description: "720 POPS" },
                    { name: "FP16/BF16 Tensor Core", description: "360 PFLOPS" },
                    { name: "TF32 Tensor Core", description: "180 PFLOPS" },
                    { name: "FP32", description: "5,760 TFLOPS" },
                    { name: "FP64", description: "2,880 TFLOPS" },
                    { name: "FP64 Tensor Core", description: "2,880 TFLOPS" },
                    { name: "GPU Memory | Bandwidth", description: "Up to 13.4 TB HBM3e | 576 TB/s" },
                    { name: "NVLink Bandwidth", description: "130 TB/s" },
                    { name: "CPU Core Count", description: "2,592 Arm Neoverse V2 cores" },
                    { name: "CPU Memory | Bandwidth", description: "Up to 17 TB LPDDR5X | Up to 18.4 TB/s" },
                ]
            },
            {
                title: "Building",
                specs: [
                    { name: "Building Height", description: "22m" },
                    { name: "Building Perimeter", description: "280m" },
                    { name: "Floor Area", description: "12,000m²" },
                    { name: "Footprint Area", description: "6,000m²" },
                    { name: "Roof Area", description: "6,200m²" },
                    { name: "Cladding Area", description: "8,000m²" },
                    { name: "Building Volume", description: "150,000m³" },
                    { name: "Rack Conditioning Area", description: "4,500m²" },
                    { name: "Compute to Leaf", description: "0.3ms" },
                    { name: "Leaf to Core", description: "0.6ms" }
                ]
            }
        ]
    }
]

export function getData(gpu: string): KPIData {
    const match = KPI_DATA.find(
        (item) =>
            item.gpu === gpu
    )
    return match ? match : { gpu: "", kpis: [], specSets: [] }
}

export function getSiteData(site: string): SpecificationSet {
    const match = SITE_DATA.find((item) => item.title === site)
    return match ? match : { title: "", specs: []}
}