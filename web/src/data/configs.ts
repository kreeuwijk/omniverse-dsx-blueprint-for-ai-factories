import { KPI, SpecificationSet } from "./kpis";

export type ConfigKPI = KPI & {
    day?: number;
    hour?: number;
};

export type ConfigRecord = {
    config: string;
    location: string;
    computePlatform: string;
    powerGen: string;
    kpis: ConfigKPI[];
    specSets: SpecificationSet[];
};

type ConfigsData = ConfigRecord[];

export const CONFIGS_DATA: ConfigsData = [
    {
        config: "Configuration 1",
        location: "Virginia, United States",
        computePlatform: "NVIDIA GB300",
        powerGen: "Grid",
        kpis: [
            { name: "Token Efficiency", description: "Total Facility Power / Tokens generated", value: 0.0003, unit: "kWh / token", score: 95, icon: "TE" },
            { name: "Power Usage Effectiveness (PUE)", description: "Total Facility Power / IT Power", value: 1.2, unit: "ratio", score: 85, icon: "PUE", day: 152, hour: 5 },
            { name: "Water Usage Effectiveness (WUE)", description: "Total Water usage / IT Power", value: 1.5, unit: "m³/MWh", score: 85, icon: "WUE" },
            { name: "Carbon Usage Effectiveness (CUE)", description: "Total Carbon Emissions / IT Power", value: 0.05, unit: "Kg/kWh", score: 65, icon: "CUE", day: 152, hour: 5 },
            { name: "Total Energy Use by Asset", description: "", value: 186, unit: "MWh", score: 99, icon: "POWER" },
            { name: "Cost by Subcategory", description: "", value: 7401791000, unit: "$", score: 97, icon: "COST" },
        ],
        specSets: [
            {
                title: "Site: Virginia, USA",
                specs: [
                    { name: "Power Capacity", description: "1-gigawatt (GW) capacity. Dedicated, on-site electrical substation with direct, high-voltage connection to the grid." },
                    { name: "Land Area", description: "1,200 acres." },
                    { name: "Water Supply", description: "Site has a reliable water source from city water system." },
                    { name: "Building Size", description: "2,000,000 sq ft." },
                    { name: "Internal Architecture", description: "800V DC power distribution and new Open Compute Project (OCP) standards for power and cooling." },
                    { name: "Permits", description: "The location is already zoned for industrial use." },
                    { name: "Connectivity", description: "The site has access to high-speed, high-capacity fiber optic network infrastructure for the necessary data transmission needs." },
                ],
            },
            {
                title: "GPU: NVIDIA GB300 NVL72",
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
                    { name: "FP64 / FP64 Tensor Core", description: "100 TFLOPS" },
                ],
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
                    { name: "Leaf to Core", description: "0.6ms" },
                ],
            },
        ],
    },
    {
        config: "Configuration 2",
        location: "Austin, Texas, United States",
        computePlatform: "NVIDIA GB200",
        powerGen: "Hybrid (Grid + Solar)",
        kpis: [
            { name: "Token Efficiency", description: "Total Facility Power / Tokens generated", value: 0.00028, unit: "kWh / token", score: 93, icon: "TE" },
            { name: "Power Usage Effectiveness (PUE)", description: "Total Facility Power / IT Power", value: 1.15, unit: "ratio", score: 88, icon: "PUE", day: 96, hour: 12 },
            { name: "Water Usage Effectiveness (WUE)", description: "Total Water usage / IT Power", value: 1.2, unit: "m³/MWh", score: 90, icon: "WUE" },
            { name: "Carbon Usage Effectiveness (CUE)", description: "Total Carbon Emissions / IT Power", value: 0.04, unit: "Kg/kWh", score: 72, icon: "CUE", day: 96, hour: 12 },
            { name: "Total Energy Use by Asset", description: "", value: 210, unit: "MWh", score: 98, icon: "POWER" },
            { name: "Cost by Subcategory", description: "", value: 6820000000, unit: "$", score: 95, icon: "COST" },
        ],
        specSets: [
            {
                title: "Site: Austin, Texas, USA",
                specs: [
                    { name: "Power Capacity", description: "800 MW capacity with on-site solar farm and grid tie-in via dedicated substation." },
                    { name: "Land Area", description: "900 acres." },
                    { name: "Water Supply", description: "Municipal water with redundancy and onsite treatment." },
                    { name: "Building Size", description: "1,500,000 sq ft." },
                    { name: "Internal Architecture", description: "400V/800V mixed DC distribution and liquid cooling loops." },
                    { name: "Permits", description: "Zoned for industrial; environmental approvals in place." },
                    { name: "Connectivity", description: "Multiple Tier-1 fiber providers with diverse path entries." },
                ],
            },
            {
                title: "GPU: NVIDIA GB200 SuperPod",
                specs: [
                    { name: "Configuration", description: "48 NVIDIA Blackwell GPUs, 24 Grace CPUs" },
                    { name: "NVLink Bandwidth", description: "80 TB/s" },
                    { name: "Fast Memory", description: "24 TB" },
                    { name: "GPU Memory | Bandwidth", description: "12 TB | Up to 420 TB/s" },
                    { name: "CPU Memory | Bandwidth", description: "9 TB LPDDR5X | 9 TB/s" },
                    { name: "CPU Core Count", description: "1,728 Arm Neoverse V2 cores" },
                    { name: "FP4 Tensor Core", description: "1020 PFLOPS" },
                    { name: "FP8/FP6 Tensor Core", description: "520 PFLOPS" },
                    { name: "INT8 Tensor Core", description: "18 POPS" },
                    { name: "FP16/BF Tensor Core", description: "250 PFLOPS" },
                    { name: "TF32 Tensor Core", description: "125 PFLOPS" },
                    { name: "FP32", description: "4 PFLOPS" },
                    { name: "FP64 / FP64 Tensor Core", description: "80 TFLOPS" },
                ],
            },
            {
                title: "Building",
                specs: [
                    { name: "Building Height", description: "20m" },
                    { name: "Building Perimeter", description: "240m" },
                    { name: "Floor Area", description: "10,500m²" },
                    { name: "Footprint Area", description: "5,300m²" },
                    { name: "Roof Area", description: "5,400m²" },
                    { name: "Cladding Area", description: "7,200m²" },
                    { name: "Building Volume", description: "120,000m³" },
                    { name: "Rack Conditioning Area", description: "3,900m²" },
                    { name: "Compute to Leaf", description: "0.28ms" },
                    { name: "Leaf to Core", description: "0.55ms" },
                ],
            },
        ],
    },
    {
        config: "Configuration 3",
        location: "Dublin, Ireland",
        computePlatform: "NVIDIA GB300",
        powerGen: "Grid (Renewable-heavy)",
        kpis: [
            { name: "Token Efficiency", description: "Total Facility Power / Tokens generated", value: 0.00031, unit: "kWh / token", score: 92, icon: "TE" },
            { name: "Power Usage Effectiveness (PUE)", description: "Total Facility Power / IT Power", value: 1.18, unit: "ratio", score: 87, icon: "PUE", day: 201, hour: 8 },
            { name: "Water Usage Effectiveness (WUE)", description: "Total Water usage / IT Power", value: 1.1, unit: "m³/MWh", score: 92, icon: "WUE" },
            { name: "Carbon Usage Effectiveness (CUE)", description: "Total Carbon Emissions / IT Power", value: 0.03, unit: "Kg/kWh", score: 80, icon: "CUE", day: 201, hour: 8 },
            { name: "Total Energy Use by Asset", description: "", value: 175, unit: "MWh", score: 97, icon: "POWER" },
            { name: "Cost by Subcategory", description: "", value: 5980000000, unit: "€", score: 94, icon: "COST" },
        ],
        specSets: [
            {
                title: "Site: Dublin, Ireland",
                specs: [
                    { name: "Power Capacity", description: "600 MW capacity with high renewable penetration from grid." },
                    { name: "Land Area", description: "700 acres." },
                    { name: "Water Supply", description: "Municipal water with conservation measures." },
                    { name: "Building Size", description: "1,200,000 sq ft." },
                    { name: "Internal Architecture", description: "OCP-compliant racks with rear-door heat exchangers." },
                    { name: "Permits", description: "Industrial zoning and EU environmental compliance." },
                    { name: "Connectivity", description: "Direct backhaul to major European IXPs; dual diverse fiber paths." },
                ],
            },
            {
                title: "GPU: NVIDIA GB300 NVL36",
                specs: [
                    { name: "Configuration", description: "36 NVIDIA Blackwell Ultra GPUs, 18 Grace CPUs" },
                    { name: "NVLink Bandwidth", description: "65 TB/s" },
                    { name: "Fast Memory", description: "18 TB" },
                    { name: "GPU Memory | Bandwidth", description: "9 TB | Up to 300 TB/s" },
                    { name: "CPU Memory | Bandwidth", description: "7 TB LPDDR5X | 7 TB/s" },
                    { name: "CPU Core Count", description: "1,296 Arm Neoverse V2 cores" },
                    { name: "FP4 Tensor Core", description: "540 PFLOPS" },
                    { name: "FP8/FP6 Tensor Core", description: "360 PFLOPS" },
                    { name: "INT8 Tensor Core", description: "12 POPS" },
                    { name: "FP16/BF Tensor Core", description: "180 PFLOPS" },
                    { name: "TF32 Tensor Core", description: "90 PFLOPS" },
                    { name: "FP32", description: "3 PFLOPS" },
                    { name: "FP64 / FP64 Tensor Core", description: "60 TFLOPS" },
                ],
            },
            {
                title: "Building",
                specs: [
                    { name: "Building Height", description: "18m" },
                    { name: "Building Perimeter", description: "220m" },
                    { name: "Floor Area", description: "9,800m²" },
                    { name: "Footprint Area", description: "4,700m²" },
                    { name: "Roof Area", description: "4,900m²" },
                    { name: "Cladding Area", description: "6,500m²" },
                    { name: "Building Volume", description: "100,000m³" },
                    { name: "Rack Conditioning Area", description: "3,400m²" },
                    { name: "Compute to Leaf", description: "0.32ms" },
                    { name: "Leaf to Core", description: "0.58ms" },
                ],
            },
        ],
    },
];