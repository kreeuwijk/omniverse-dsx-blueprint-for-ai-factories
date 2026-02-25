import React, { createContext, useContext, useState } from 'react';
import { Gpu, Power, Site, Country, Region } from "@/data/options"

export type Config = {
    name: string
    gpu: Gpu,
    site: Site,
    power: Power
}

// ---------------------------------------------------------
// Valid Values Arrays (for validation by AgentPanel)
// ---------------------------------------------------------

export const VALID_COUNTRIES: Country[] = ['United States', 'Sweden'];
export const VALID_POWER_SOURCES: Power[] = ['Grid', 'Hybrid', 'On-Prem'];

type ConfigContextType = {
    selectedGpu: Gpu | null
    setSelectedGpu: (gpu: Gpu | null) => void

    selectedSite: Site | null
    setSelectedSite: (site: Site | null) => void

    selectedPower: Power | null
    setSelectedPower: (power: Power | null) => void

    // Country/Region state for Site configurator (allows AI Agent control)
    selectedCountry: Country | null
    setSelectedCountry: (country: Country | null) => void

    selectedRegion: Region | null
    setSelectedRegion: (region: Region | null) => void

    savedConfigs: Config[]
    saveConfiguration: (name: string) => void
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined)

export const DS9ConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [selectedGpu, setSelectedGpu] = useState<Gpu | null>('NVIDIA GB300');
    const [selectedSite, setSelectedSite] = useState<Site | null>(null);
    const [selectedPower, setSelectedPower] = useState<Power | null>('Grid');
    
    // Country/Region state (moved from ConfiguratorPanel for AI Agent access)
    const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
    const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);
    
    const [savedConfigs, setSavedConfigs] = useState<Config[]>([]);

    const saveConfiguration = (name: string) => {
        if (selectedGpu && selectedSite && selectedPower) {
            const newConfig: Config = {
                name,
                gpu: selectedGpu,
                site: selectedSite,
                power: selectedPower
            }
            setSavedConfigs((prev) => [...prev, newConfig])
        }
    }

    return (
        <ConfigContext.Provider
            value={{
                selectedGpu,
                setSelectedGpu,
                selectedSite,
                savedConfigs, 
                selectedPower,
                setSelectedPower,
                setSelectedSite,
                selectedCountry,
                setSelectedCountry,
                selectedRegion,
                setSelectedRegion,
                saveConfiguration,
            }}
        >
            {children}
        </ConfigContext.Provider>
    )
}

export const useConfig = () => {
    const context = useContext(ConfigContext)
    if (!context) throw new Error("useConfig must be used within ConfigProvider")
    return context
}

