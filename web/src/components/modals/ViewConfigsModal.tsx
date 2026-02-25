import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useUI } from "@/context/UIContext";
import { CONFIGS_DATA } from "@/data/configs";
import ConfigurationModalPanel from "../panels/ConfigurationModalPanel";
import { useConfig } from "@/context/DS9Context";
import { Button } from "../ui/button";
import { usePagination } from "@/hooks/usePagination";

const ViewConfigsModal = () => {
    const { state, dispatch } = useUI();
    const { savedConfigs } = useConfig();

    const showViewer = state.viewer;

    const savedConfigsMock = savedConfigs.map(
        ({ gpu, name, power, site }) => ({
            ...CONFIGS_DATA[0],
            computePlatform: gpu,
            location: site,
            powerGen: power,
            config: name,
        })
    );

    const {
        safePage,
        totalPages,
        pagedItems: pagedConfigs,
        goPrev,
        goNext,
    } = usePagination(savedConfigsMock, {
        initialPage: 1,
    });

    const handleOpenChange = () => {
        dispatch({ type: "TOGGLE_VIEWER" });
    };

    const handleContentClick = (e: React.MouseEvent<HTMLDivElement>) => {
        e.stopPropagation();
        dispatch({ type: "TOGGLE_VIEWER" });
    };

    if (!showViewer) return null;

    return (
        <Dialog open={showViewer} onOpenChange={handleOpenChange}>
            <DialogContent
                showCloseButton={false}
                onClick={handleContentClick}
                onPointerDownOutside={(e) => e.preventDefault()}
                onInteractOutside={(e) => e.preventDefault()}
                className="bg-transparent border-none shadow-none pt-40 pb-20 pl-[10rem] pr-[5rem] z-10 gap-[5rem] h-screen w-screen max-w-none justify-around flex overflow-auto pointer-events-none"
            >
                <div className="flex gap-[5rem] justify-around pointer-events-auto">
                    {pagedConfigs.map((config, i) => (
                        <ConfigurationModalPanel key={i} {...config} /> // change to unique key when real data will be ready
                    ))}
                </div>

                {savedConfigsMock.length > 3 ? (
                    <div onClick={(e) => e.stopPropagation()} className="pointer-events-auto fixed bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/30 backdrop-blur-sm rounded-lg px-4 py-2">
                        <Button
                            variant="secondary"
                            onClick={goPrev}
                            disabled={safePage === 1}
                            className="min-w-24"
                        >
                            Prev
                        </Button>
                        <span className="text-white/90" aria-live="polite">
                            Page {safePage} / {totalPages}
                        </span>
                        <Button
                            variant="secondary"
                            onClick={goNext}
                            disabled={safePage === totalPages}
                            className="min-w-24"
                        >
                            Next
                        </Button>
                    </div>
                ) : null}
            </DialogContent>
        </Dialog>
    );
};

export default ViewConfigsModal;