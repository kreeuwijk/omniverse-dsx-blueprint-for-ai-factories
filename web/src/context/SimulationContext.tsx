import React, { createContext, useContext, useState } from 'react';

/**
 * SimulationContext.tsx
 *
 * Context for managing simulation state across the application.
 * This allows the AI Agent to control simulation settings via actions,
 * similar to how GPU configuration is managed in DS9Context.
 *
 * Supported simulation types:
 *   - thermal: Data Hall / Exterior zones, Normal / Emergency operations
 *   - electrical: GPU Rack / Main substation / etc zones, various operations
 */

// ---------------------------------------------------------
// Types
// ---------------------------------------------------------

/** Valid simulation panel/tab values */
export type SimulationPanel = 'thermal' | 'electrical';

/** Valid thermal zone values */
export type ThermalZone = 'Data Hall' | 'Exterior';

/** Valid thermal operation values */
export type ThermalOperation = 'Normal' | 'Emergency';

/** Valid thermal variable values */
export type ThermalVariable = 'Temperature' | 'Velocity' | 'Pressure';

/** Valid electrical zone values */
export type ElectricalZone = 'GPU Rack' | 'Main substation' | '345kV Main Sub 1-4' | 'CDU (GPU)';

/** Valid electrical operation values */
export type ElectricalOperation = 'Normal' | 'Loss of 1 utility' | 'Loss of 1 gas turbine-single generator failure';

/** Valid electrical variable values */
export type ElectricalVariable = 'Voltage' | 'Current' | 'P' | 'Q' | 'Power Factor' | 'THDi' | 'THDv' | 'Availability';

// ---------------------------------------------------------
// Valid Values Arrays (for validation)
// ---------------------------------------------------------

export const VALID_SIMULATION_PANELS: SimulationPanel[] = ['thermal', 'electrical'];

export const VALID_THERMAL_ZONES: ThermalZone[] = ['Data Hall', 'Exterior'];
export const VALID_THERMAL_OPERATIONS: ThermalOperation[] = ['Normal', 'Emergency'];
export const VALID_THERMAL_VARIABLES: ThermalVariable[] = ['Temperature', 'Velocity', 'Pressure'];

export const VALID_ELECTRICAL_ZONES: ElectricalZone[] = ['GPU Rack', 'Main substation', '345kV Main Sub 1-4', 'CDU (GPU)'];
export const VALID_ELECTRICAL_OPERATIONS: ElectricalOperation[] = ['Normal', 'Loss of 1 utility', 'Loss of 1 gas turbine-single generator failure'];
export const VALID_ELECTRICAL_VARIABLES: ElectricalVariable[] = ['Voltage', 'Current', 'P', 'Q', 'Power Factor', 'THDi', 'THDv', 'Availability'];

// ---------------------------------------------------------
// Context Type
// ---------------------------------------------------------

type SimulationContextType = {
  // Active simulation tab
  activeSimulationTab: SimulationPanel;
  setActiveSimulationTab: (tab: SimulationPanel) => void;

  // Thermal simulation state
  thermalZone: ThermalZone;
  setThermalZone: (zone: ThermalZone) => void;
  thermalOperation: ThermalOperation;
  setThermalOperation: (operation: ThermalOperation) => void;
  thermalVariable: ThermalVariable;
  setThermalVariable: (variable: ThermalVariable) => void;
  thermalHeatLoad: number;
  setThermalHeatLoad: (heatLoad: number) => void;
  thermalIsRunning: boolean;
  setThermalIsRunning: (isRunning: boolean) => void;

  // Electrical simulation state
  electricalZone: ElectricalZone;
  setElectricalZone: (zone: ElectricalZone) => void;
  electricalOperation: ElectricalOperation;
  setElectricalOperation: (operation: ElectricalOperation) => void;
  electricalVariable: ElectricalVariable;
  setElectricalVariable: (variable: ElectricalVariable) => void;
};

// ---------------------------------------------------------
// Context & Provider
// ---------------------------------------------------------

const SimulationContext = createContext<SimulationContextType | undefined>(undefined);

export const SimulationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Active simulation tab (thermal or electrical)
  const [activeSimulationTab, setActiveSimulationTab] = useState<SimulationPanel>('thermal');

  // Thermal simulation state with defaults
  const [thermalZone, setThermalZone] = useState<ThermalZone>('Data Hall');
  const [thermalOperation, setThermalOperation] = useState<ThermalOperation>('Normal');
  const [thermalVariable, setThermalVariable] = useState<ThermalVariable>('Temperature');
  const [thermalHeatLoad, setThermalHeatLoad] = useState<number>(50);
  const [thermalIsRunning, setThermalIsRunning] = useState<boolean>(false);

  // Electrical simulation state with defaults
  const [electricalZone, setElectricalZone] = useState<ElectricalZone>('GPU Rack');
  const [electricalOperation, setElectricalOperation] = useState<ElectricalOperation>('Normal');
  const [electricalVariable, setElectricalVariable] = useState<ElectricalVariable>('Voltage');

  return (
    <SimulationContext.Provider
      value={{
        activeSimulationTab,
        setActiveSimulationTab,
        thermalZone,
        setThermalZone,
        thermalOperation,
        setThermalOperation,
        thermalVariable,
        setThermalVariable,
        thermalHeatLoad,
        setThermalHeatLoad,
        thermalIsRunning,
        setThermalIsRunning,
        electricalZone,
        setElectricalZone,
        electricalOperation,
        setElectricalOperation,
        electricalVariable,
        setElectricalVariable,
      }}
    >
      {children}
    </SimulationContext.Provider>
  );
};

// ---------------------------------------------------------
// Hook
// ---------------------------------------------------------

export const useSimulation = () => {
  const context = useContext(SimulationContext);
  if (!context) throw new Error('useSimulation must be used within SimulationProvider');
  return context;
};
