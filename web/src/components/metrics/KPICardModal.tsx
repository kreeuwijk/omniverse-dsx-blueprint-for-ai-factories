import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { ScanSearch } from "lucide-react";
import CUE from "@/assets/CUE.png";
import PUE from "@/assets/PUE.png";
import IconButtonNative from "../panels/IconButtonNative";

interface KPICardModalProps {
    kpi: {
        name: string;
    }
}

const iconSrc = (name: string) => {
    switch (name) {
        case ("Power Usage Effectiveness (PUE)"):
            return PUE;
        case ("Carbon Usage Effectiveness (CUE)"):
            return CUE;
        default: null;
    }
};

const KPICardModal = ({ kpi }: KPICardModalProps) => {
    if (!iconSrc(kpi.name)) {
        return null;
    }

    return (
        <Dialog>
            <DialogTrigger asChild>
                <IconButtonNative icon={ScanSearch} size={40} className="bg-transparent text-white cursor-pointer hover:bg-transparent focus:outline-none focus:ring-0 active:bg-transparent" />
            </DialogTrigger>

            <DialogContent className="w-[85vw] bg-panel flex gap-5 flex-col items-start justify-center min-h-0 pointer-events-auto">
                <DialogHeader className="w-full">
                    <div className="box-shadow text-muted-foreground inline-flex h-9 w-full justify-between items-center pl-4 mb-5">
                        <DialogTitle className="text-xl font-bold text-white">
                            {kpi.name}
                        </DialogTitle>
                    </div>

                </DialogHeader>

                <img
                    src={iconSrc(kpi.name)}
                    alt={kpi.name}
                    className="w-full rounded-md object-contain"
                />
            </DialogContent>
        </Dialog>
    )
}

export default KPICardModal;