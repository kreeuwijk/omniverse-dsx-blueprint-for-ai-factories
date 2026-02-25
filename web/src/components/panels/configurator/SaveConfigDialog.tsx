import { useEffect, useState } from "react";

import { DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

import { useConfig } from "@/context/DS9Context";

const SaveConfigDialog = () => {
    const { selectedGpu, selectedSite, saveConfiguration } = useConfig();
    const [configName, setConfigName] = useState(`${selectedSite} ${selectedGpu} Configuration`)

    // Updates default configuration name when a user selects a new configuration option
    useEffect(() => {
        setConfigName(`${selectedSite} ${selectedGpu} Configuration`)
    }, [selectedSite, selectedGpu])

    return (
        <form>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Save Configuration</DialogTitle>
                    <DialogDescription>
                        <strong>Site: </strong> {selectedSite} <br></br>
                        <strong>GPU: </strong> {selectedGpu}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4">
                    <div className="grid gap-3">
                        <Label htmlFor="config-name" className="text-sm">Configuration Name</Label>
                        <Input id="config-name" name="name" value={configName} onChange={e => setConfigName(e.target.value)} />
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    <DialogClose asChild>
                        <Button type="submit" onClick={() => saveConfiguration(configName)}>Save</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </form>
    )
}

export default SaveConfigDialog;