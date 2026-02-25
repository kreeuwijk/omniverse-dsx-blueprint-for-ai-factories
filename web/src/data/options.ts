// This file contains all the options available for the site, gpu, and power configurators. It also includes site locations for the map scene view.

export type Country = "United States" | "Sweden"
export type Region = "Virginia" | "New Mexico"
export type Site = Country | Region

export type Gpu = "NVIDIA GB300" | "NVIDIA GB200"
export type Power = "Grid" | "Hybrid" | "On-Prem"

type ConfiguratorOptions = {
    gpuOptions: Gpu[],
    siteOptions: (Country | Region)[]
    powerOptions: Power[]
}

export const CONFIGURATOR_OPTIONS: ConfiguratorOptions = {
    gpuOptions: ["NVIDIA GB300", "NVIDIA GB200"],
    siteOptions: ["Virginia", "New Mexico", "Sweden"],
    powerOptions: ["Grid", "Hybrid", "On-Prem"],
}

/**
 * Maps backend GPU format to display format for the UI dropdown.
 * Exported so other components (e.g., AgentPanel, ConfiguratorPanel) can reuse
 * the same mapping instead of defining their own copies.
 */
export const gpuDisplayMap: Record<string, Gpu> = {
    "GB200": "NVIDIA GB200",
    "GB300": "NVIDIA GB300"
};

// SIMULATIONS
type SimulationSubCategory = {
    zones: string[],
    operations: string[],
    variables: Record<string, SimulationRange>,
}

export const SIMULATION_OPTIONS: Record<string, SimulationSubCategory> = {
    "thermal": {
        zones: ["Data Hall", "Exterior"],
        operations: ["Normal", "Emergency"],
        variables: {
            "Temperature": { start: "25 \u00B0C", end: "45 \u00B0C" },
            "Velocity": { start: " fps", end: " fps" },
            "Pressure": { start: " Pa", end: "Pa" }
        }
    },
    "electrical": {
        zones: ["GPU Rack", "Main substation", "345kV Main Sub 1-4", "CDU (GPU)"],
        operations: ["Normal", "Loss of 1 utility", "Loss of 1 gas turbine-single generator failure"],
        variables: {
            "Voltage": { start: "kV", end: "kV" },
            "Current": { start: "kA", end: "kA" },
            "P": { start: "MW", end: "MW" },
            "Q": { start: "MVAr", end: "MVAr" },
            "Power Factor": { start: "%", end: "%" },
            "THDi": { start: "%", end: "%" },
            "THDv": { start: "%", end: "%" },
            "Availability": { start: "%", end: "%" }
        }
    }
}

type SimulationRange = {
    start: string;
    end: string;
}

export const SITE_OPTIONS: Record<Country, Region[]> = {
    "Sweden": [],
    "United States": ["New Mexico", "Virginia"]
}