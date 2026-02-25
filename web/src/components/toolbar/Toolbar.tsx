import { Settings2Icon, CameraIcon, SparklesIcon, ChartColumnIncreasingIcon, SquareActivityIcon, FileSlidersIcon } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Item } from "@/components/ui/item";
import { Popover, PopoverContent } from "@/components/ui/popover";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import dsxLogo from "@/assets/NV-Symbol.png";
import { useUI, CameraName } from "@/context/UIContext";
import IconButtonNative from "@/components/panels/IconButtonNative";
import { switchCamera } from "@/streamMessages";
import { useConfig } from "@/context/DS9Context";
import { TooltipWrapper } from "../TooltipWrapper";
import { ToggleButtonNative } from "../panels/ToggleButtonNative";

const cameraLabelMap: Record<string, string> = {
    'camera_int_datahall_01': 'Data hall row',
    'camera_int_datahall_02': 'Racks close-up',
    'camera_int_datahall_03': 'Hot aisle cooling',
    'camera_int_datahall_04': 'Hot aisle power',
    'camera_ext_default_01': 'Campus aerial',
    'camera_ext_default_02': 'Back power yard',
    'camera_ext_default_03': 'Cooling towers',
    'camera_ext_default_04': 'Front entrance',
};

const Toolbar = () => {
    const { state, dispatch } = useUI();
    const { savedConfigs, selectedSite } = useConfig();

    const handleCameraSelect = async (camera: string) => {
        dispatch({ type: "SET_ACTIVE_CAMERA", camera: camera as CameraName });
        switchCamera(`/World/interactive_cameras/${camera}`);
    };

    return (
        <div className="absolute z-50 p-8 left-0 pointer-events-auto">
            <Item className="w-[80px] bg-panel backdrop-blur-large rounded-lg shadow-lg border border-white/10 flex flex-col">
                <div className="flex flex-col items-center gap-4 py-4 [scrollbar-width:none]">
                    <TooltipWrapper text="Agent" asChildTrigger>
                        <ToggleButtonNative icon={SparklesIcon} active={state.agent} action="TOGGLE_AGENT" />
                    </TooltipWrapper>
                    <Separator className="my-2 bg-white/20" />
                    <div className="text-[10px] tracking-widest font-semibold text-white/70 select-none text-center">
                        MAIN
                    </div>
                    <TooltipWrapper text="Configurator">
                        <ToggleButtonNative icon={Settings2Icon} active={state.configurator} action="TOGGLE_CONFIGURATOR" />
                    </TooltipWrapper>
                    <TooltipWrapper text="Analytics">
                        <ToggleButtonNative disabled={!selectedSite} icon={ChartColumnIncreasingIcon} active={state.analytics} action="TOGGLE_ANALYTICS" />
                    </TooltipWrapper>
                    <TooltipWrapper text="Simulations">
                        <ToggleButtonNative icon={SquareActivityIcon} active={state.simulations} action="TOGGLE_SIMULATIONS" />
                    </TooltipWrapper>
                    <TooltipWrapper text={!savedConfigs?.length ? "Save Configurations to compare" : "Compare Configurations"}>
                        <ToggleButtonNative disabled={!savedConfigs?.length} icon={FileSlidersIcon} active={state.viewer} action="TOGGLE_VIEWER" />
                    </TooltipWrapper>
                    <Separator className="my-2 bg-white/20" />
                    <div className="text-[10px] tracking-widest font-semibold text-white/70 select-none text-center">
                        VIEW
                    </div>
                    <Popover>

                        <TooltipWrapper text="Camera" >
                            <PopoverPrimitive.Trigger asChild>
                                <IconButtonNative icon={CameraIcon} />
                            </PopoverPrimitive.Trigger>

                        </TooltipWrapper>

                        <PopoverContent side="right" sideOffset={20}>
                            <RadioGroup defaultValue={state.activeCamera} onValueChange={handleCameraSelect}>
                                {["camera_int_datahall_01", "camera_int_datahall_02", "camera_int_datahall_03", "camera_int_datahall_04", "camera_ext_default_01", "camera_ext_default_02", "camera_ext_default_03", "camera_ext_default_04"].map((camera) => (
                                    <div key={camera} className="flex items-center space-x-2">
                                        <RadioGroupItem value={camera} id={camera} />
                                        <Label htmlFor={camera}>{cameraLabelMap[camera]}</Label>
                                    </div>
                                ))}
                            </RadioGroup>
                        </PopoverContent>
                    </Popover>
                </div>
                <div className="flex justify-center">
                    <img src={dsxLogo} />
                </div>
            </Item>
        </div>
    );
};

export default Toolbar;