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

// ── Reusable site spec blocks ────────────────────────────────────────

const SITE_VIRGINIA: SpecificationSet = {
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
};

const SITE_NEW_MEXICO: SpecificationSet = {
    title: "Site: New Mexico, USA",
    specs: [
        { name: "Power Capacity", description: "800 MW capacity with on-site solar farm and grid tie-in via dedicated substation." },
        { name: "Land Area", description: "1,500 acres." },
        { name: "Water Supply", description: "Reclaimed water supply with on-site treatment and closed-loop cooling to minimize consumption in arid climate." },
        { name: "Building Size", description: "1,500,000 sq ft." },
        { name: "Internal Architecture", description: "400V/800V mixed DC distribution and liquid cooling loops." },
        { name: "Permits", description: "Zoned for industrial; environmental approvals in place." },
        { name: "Connectivity", description: "Multiple Tier-1 fiber providers with diverse path entries." },
    ],
};

const SITE_SWEDEN: SpecificationSet = {
    title: "Site: Sweden",
    specs: [
        { name: "Power Capacity", description: "600 MW capacity with high renewable penetration from the Nordic grid (hydro and wind)." },
        { name: "Land Area", description: "700 acres." },
        { name: "Water Supply", description: "Municipal water with conservation measures; cold climate reduces cooling water demand." },
        { name: "Building Size", description: "1,200,000 sq ft." },
        { name: "Internal Architecture", description: "OCP-compliant racks with rear-door heat exchangers optimized for free-air cooling." },
        { name: "Permits", description: "Industrial zoning and EU environmental compliance." },
        { name: "Connectivity", description: "Direct backhaul to major European IXPs; dual diverse fiber paths." },
    ],
};

// ── Reusable GPU spec blocks ─────────────────────────────────────────

const GPU_GB300: SpecificationSet = {
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
};

const GPU_GB200: SpecificationSet = {
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
};

// ── Reusable building spec blocks ────────────────────────────────────

const BUILDING_VIRGINIA: SpecificationSet = {
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
};

const BUILDING_NEW_MEXICO: SpecificationSet = {
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
};

const BUILDING_SWEDEN: SpecificationSet = {
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
};

// ── All 6 site × GPU combinations ───────────────────────────────────

export const CONFIGS_DATA: ConfigsData = [
    // Virginia + GB300
    {
        config: "Virginia / GB300",
        location: "Virginia",
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
        specSets: [SITE_VIRGINIA, GPU_GB300, BUILDING_VIRGINIA],
    },
    // Virginia + GB200
    {
        config: "Virginia / GB200",
        location: "Virginia",
        computePlatform: "NVIDIA GB200",
        powerGen: "Grid",
        kpis: [
            { name: "Token Efficiency", description: "Total Facility Power / Tokens generated", value: 0.00035, unit: "kWh / token", score: 90, icon: "TE" },
            { name: "Power Usage Effectiveness (PUE)", description: "Total Facility Power / IT Power", value: 1.22, unit: "ratio", score: 83, icon: "PUE", day: 152, hour: 5 },
            { name: "Water Usage Effectiveness (WUE)", description: "Total Water usage / IT Power", value: 1.55, unit: "m³/MWh", score: 83, icon: "WUE" },
            { name: "Carbon Usage Effectiveness (CUE)", description: "Total Carbon Emissions / IT Power", value: 0.052, unit: "Kg/kWh", score: 63, icon: "CUE", day: 152, hour: 5 },
            { name: "Total Energy Use by Asset", description: "", value: 172, unit: "MWh", score: 97, icon: "POWER" },
            { name: "Cost by Subcategory", description: "", value: 6250000000, unit: "$", score: 95, icon: "COST" },
        ],
        specSets: [SITE_VIRGINIA, GPU_GB200, BUILDING_VIRGINIA],
    },
    // New Mexico + GB300
    {
        config: "New Mexico / GB300",
        location: "New Mexico",
        computePlatform: "NVIDIA GB300",
        powerGen: "Hybrid",
        kpis: [
            { name: "Token Efficiency", description: "Total Facility Power / Tokens generated", value: 0.00028, unit: "kWh / token", score: 93, icon: "TE" },
            { name: "Power Usage Effectiveness (PUE)", description: "Total Facility Power / IT Power", value: 1.15, unit: "ratio", score: 88, icon: "PUE", day: 96, hour: 12 },
            { name: "Water Usage Effectiveness (WUE)", description: "Total Water usage / IT Power", value: 1.2, unit: "m³/MWh", score: 90, icon: "WUE" },
            { name: "Carbon Usage Effectiveness (CUE)", description: "Total Carbon Emissions / IT Power", value: 0.04, unit: "Kg/kWh", score: 72, icon: "CUE", day: 96, hour: 12 },
            { name: "Total Energy Use by Asset", description: "", value: 195, unit: "MWh", score: 98, icon: "POWER" },
            { name: "Cost by Subcategory", description: "", value: 6820000000, unit: "$", score: 95, icon: "COST" },
        ],
        specSets: [SITE_NEW_MEXICO, GPU_GB300, BUILDING_NEW_MEXICO],
    },
    // New Mexico + GB200
    {
        config: "New Mexico / GB200",
        location: "New Mexico",
        computePlatform: "NVIDIA GB200",
        powerGen: "Hybrid",
        kpis: [
            { name: "Token Efficiency", description: "Total Facility Power / Tokens generated", value: 0.00033, unit: "kWh / token", score: 89, icon: "TE" },
            { name: "Power Usage Effectiveness (PUE)", description: "Total Facility Power / IT Power", value: 1.18, unit: "ratio", score: 86, icon: "PUE", day: 96, hour: 12 },
            { name: "Water Usage Effectiveness (WUE)", description: "Total Water usage / IT Power", value: 1.25, unit: "m³/MWh", score: 88, icon: "WUE" },
            { name: "Carbon Usage Effectiveness (CUE)", description: "Total Carbon Emissions / IT Power", value: 0.042, unit: "Kg/kWh", score: 70, icon: "CUE", day: 96, hour: 12 },
            { name: "Total Energy Use by Asset", description: "", value: 180, unit: "MWh", score: 96, icon: "POWER" },
            { name: "Cost by Subcategory", description: "", value: 5750000000, unit: "$", score: 93, icon: "COST" },
        ],
        specSets: [SITE_NEW_MEXICO, GPU_GB200, BUILDING_NEW_MEXICO],
    },
    // Sweden + GB300
    {
        config: "Sweden / GB300",
        location: "Sweden",
        computePlatform: "NVIDIA GB300",
        powerGen: "Grid",
        kpis: [
            { name: "Token Efficiency", description: "Total Facility Power / Tokens generated", value: 0.00026, unit: "kWh / token", score: 96, icon: "TE" },
            { name: "Power Usage Effectiveness (PUE)", description: "Total Facility Power / IT Power", value: 1.1, unit: "ratio", score: 92, icon: "PUE", day: 201, hour: 8 },
            { name: "Water Usage Effectiveness (WUE)", description: "Total Water usage / IT Power", value: 1.1, unit: "m³/MWh", score: 92, icon: "WUE" },
            { name: "Carbon Usage Effectiveness (CUE)", description: "Total Carbon Emissions / IT Power", value: 0.03, unit: "Kg/kWh", score: 80, icon: "CUE", day: 201, hour: 8 },
            { name: "Total Energy Use by Asset", description: "", value: 175, unit: "MWh", score: 97, icon: "POWER" },
            { name: "Cost by Subcategory", description: "", value: 5980000000, unit: "$", score: 94, icon: "COST" },
        ],
        specSets: [SITE_SWEDEN, GPU_GB300, BUILDING_SWEDEN],
    },
    // Sweden + GB200
    {
        config: "Sweden / GB200",
        location: "Sweden",
        computePlatform: "NVIDIA GB200",
        powerGen: "Grid",
        kpis: [
            { name: "Token Efficiency", description: "Total Facility Power / Tokens generated", value: 0.00031, unit: "kWh / token", score: 92, icon: "TE" },
            { name: "Power Usage Effectiveness (PUE)", description: "Total Facility Power / IT Power", value: 1.13, unit: "ratio", score: 90, icon: "PUE", day: 201, hour: 8 },
            { name: "Water Usage Effectiveness (WUE)", description: "Total Water usage / IT Power", value: 1.15, unit: "m³/MWh", score: 90, icon: "WUE" },
            { name: "Carbon Usage Effectiveness (CUE)", description: "Total Carbon Emissions / IT Power", value: 0.032, unit: "Kg/kWh", score: 78, icon: "CUE", day: 201, hour: 8 },
            { name: "Total Energy Use by Asset", description: "", value: 162, unit: "MWh", score: 95, icon: "POWER" },
            { name: "Cost by Subcategory", description: "", value: 5100000000, unit: "$", score: 92, icon: "COST" },
        ],
        specSets: [SITE_SWEDEN, GPU_GB200, BUILDING_SWEDEN],
    },
];
