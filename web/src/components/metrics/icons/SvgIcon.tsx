/// <reference types="vite-plugin-svgr/client" />

import CUE from '@/assets/kpis/CUE.svg?react'
import PUE from '@/assets/kpis/PUE.svg?react'
import TE from '@/assets/kpis/TE.svg?react'
import WUE from '@/assets/kpis/WUE.svg?react'
import POWER from '@/assets/kpis/POWER.svg?react'
import COST from '@/assets/kpis/COST.svg?react'

const icons = {
    TE: TE,
    PUE: PUE,
    WUE: WUE,
    CUE: CUE,
    POWER: POWER,
    COST: COST
}

export type IconName = keyof typeof icons;

export interface SvgIconProps extends React.SVGProps<SVGSVGElement> {
    name: IconName;
}

const SvgIcon: React.FC<SvgIconProps> = ({ name, ...props }) => {
    const Icon = icons[name];
    if (!Icon) {
        console.warn(`SvgIcon: unknown icon name "${name}"`);
        return null;
    }
    return <Icon {...props} />;
};

export default SvgIcon;