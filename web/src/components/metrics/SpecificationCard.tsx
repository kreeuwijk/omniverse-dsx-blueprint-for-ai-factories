import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Specification } from "@/data/kpis"
import chip from "@/assets/chip.png";
import { useUI } from "@/context/UIContext";

interface ChildProps {
    specs: Specification[];
    title: string;
}

const SpecificationCard = ({ specs, title }: ChildProps) => {
    const { state } = useUI();
    return (
        <div>
            <Card className="spec">
                <CardHeader className="">
                    <div className="flex justify-between items-center">
                        <CardTitle className="text-xl">{title}</CardTitle>
                        {(title !== "Building" && state.activeConfigMode === "gpu") ? <img src={chip} /> : null}
                    </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-1">
                    {specs.map(spec => {
                        return <div key={spec.name}>
                            <span className="text-xs font-semibold">{spec.name}: </span>
                            <span className="text-xs font-light">{spec.description}</span>
                        </div>
                    })}
                </CardContent>
            </Card>
        </div>
    )
}

export default SpecificationCard;