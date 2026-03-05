import { useMemo, useEffect, useRef } from "react"
import { Button } from "../../ui/button"
import { Label } from "../../ui/label"
import { RadioGroup, RadioGroupItem } from "../../ui/radio-group"
import { sendPowerFailureData, syncAgentState } from "../../../streamMessages"
import { useSimulation } from "@/context/SimulationContext"

// ─── Types ───────────────────────────────────────────────────────────────────

type BuswayMatrixRow = {
    ph: number
    current: number
    power: number
    overloaded: boolean
    failed: boolean
}

// ─── Constants ───────────────────────────────────────────────────────────────

const RPP_KW = 500
const FEEDER = 60
const MAX_WIP_POWER: Record<string, number> = { '1.2': 146, '1.5': 173 }

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Randomise phase-to-phase voltage around ~415V based on load level */
const randPh = (load: number) => {
    const high = [413, 414]
    const low = [416, 417]
    const base = [414, 415, 416]
    if (load > 80) return high[Math.floor(Math.random() * high.length)]
    if (load < 20) return low[Math.floor(Math.random() * low.length)]
    return base[Math.floor(Math.random() * base.length)]
}

/** Current (A) = Power (kW) × 1000 / [√3 × Voltage (V)] */
const calcCurrent = (kw: number, voltage: number) => {
    const amps = (kw * 1000) / (voltage * Math.sqrt(3))
    return Math.round(amps)
}

/** Returns a Tailwind class string for table cell background colouring */
const cellBg = ({
    failed,
    canOverload,
    overloaded,
    canEnergize = true,
    canFail = true,
}: {
    failed?: boolean
    canOverload?: boolean
    overloaded?: boolean
    canEnergize?: boolean
    canFail?: boolean
}) => {
    if (canFail && failed) return 'bg-green-500/80 text-white'
    if (canOverload && overloaded) return 'bg-purple-600/80 text-white'
    return canEnergize ? 'bg-red-900/30' : ''
}

// ─── Sub-components ──────────────────────────────────────────────────────────

/** Single table cell that is coloured according to its busway state */
const Cell = ({
    data,
    valueKey,
    canOverload,
}: { data: BuswayMatrixRow; canOverload?: boolean; valueKey: keyof BuswayMatrixRow }) => (
    <td className={`px-3 py-2 text-center text-sm ${cellBg({ failed: data.failed, canOverload, overloaded: data.overloaded })}`}>
        {data.failed ? '-' : data[valueKey]}
    </td>
)

/** Blank table shown when the test is not running */
const BlankTable = () => (
    <>
        <table className="w-full text-sm">
            <thead>
                <tr className="border-b border-white/10">
                    <th className="px-3 py-2 text-left w-[100px] font-medium">RPP</th>
                    <th className="px-3 py-2 text-center font-medium">A</th>
                    <th className="px-3 py-2 text-center font-medium">B</th>
                    <th className="px-3 py-2 text-center font-medium">C</th>
                    <th className="px-3 py-2 text-center font-medium">D</th>
                </tr>
            </thead>
            <tbody>
                <tr className="border-b border-white/5">
                    <td className="px-3 py-2 text-sm">Ph-Ph (V)</td>
                    <td className="px-3 py-2 text-center text-sm">-</td>
                    <td className="px-3 py-2 text-center text-sm">-</td>
                    <td className="px-3 py-2 text-center text-sm">-</td>
                    <td className="px-3 py-2 text-center text-sm">-</td>
                </tr>
                <tr className="border-b border-white/5">
                    <td className="px-3 py-2 text-sm">Current (A)</td>
                    <td className="px-3 py-2 text-center text-sm">-</td>
                    <td className="px-3 py-2 text-center text-sm">-</td>
                    <td className="px-3 py-2 text-center text-sm">-</td>
                    <td className="px-3 py-2 text-center text-sm">-</td>
                </tr>
                <tr>
                    <td className="px-3 py-2 text-sm">Power (kW)</td>
                    <td className="px-3 py-2 text-center text-sm">-</td>
                    <td className="px-3 py-2 text-center text-sm">-</td>
                    <td className="px-3 py-2 text-center text-sm">-</td>
                    <td className="px-3 py-2 text-center text-sm">-</td>
                </tr>
            </tbody>
        </table>
        <div className="grid grid-cols-2 items-center text-sm mt-1">
            <div className="text-right pr-4 py-2 border-r border-white/10">Compute Service Feeder Loading</div>
            <div className="py-2 pl-4">- %</div>
        </div>
    </>
)

// ─── Main Component ──────────────────────────────────────────────────────────

export default function PowerFailureTest() {
    const {
        electricalIsPlaying: isPlaying,
        setElectricalIsPlaying: setIsPlaying,
        electricalFailedRpps: failedBusways,
        setElectricalFailedRpps: setFailedBusways,
        electricalLoadPercent: loadPercent,
        setElectricalLoadPercent: setLoadPercent,
        electricalEdpSetting: edpSetting,
        setElectricalEdpSetting: setEdpSetting,
    } = useSimulation()

    const maxLoadKw = edpSetting === '1.5' ? 1531 : 1316

    const power = failedBusways < 4
        ? Math.round(((loadPercent / 100) * maxLoadKw) / (4 - failedBusways))
        : 0

    const matrix = useMemo(() => {
        const voltageData = [randPh(loadPercent), randPh(loadPercent), randPh(loadPercent), randPh(loadPercent)]
        const currentData = voltageData.map(v => calcCurrent(power, v))

        return (['a', 'b', 'c', 'd'] as const).reduce((acc, key, i) => {
            acc[key] = {
                ph: voltageData[i],
                current: currentData[i],
                power,
                overloaded: power > RPP_KW,
                failed: failedBusways > i,
            }
            return acc
        }, {} as Record<string, BuswayMatrixRow>)
    }, [failedBusways, loadPercent, power])

    const maxWipPower = MAX_WIP_POWER[edpSetting]
    const wipCapacity = FEEDER === 60 ? 33 : 57.5
    const wipKw = loadPercent > 0 && failedBusways < 4
        ? Math.round(((loadPercent / 100) * maxWipPower) / (8 - failedBusways * 2))
        : 0
    const wipPercent = wipKw > 0 ? Math.round((wipKw / wipCapacity) * 100) : 0
    const wipFail = wipKw === 0
    const wipOverloaded = wipPercent > 100

    let status = failedBusways > 3
        ? 'Offline'
        : failedBusways > 0
            ? 'Partial Failure'
            : 'Running flawlessly'

    if (Object.values(matrix).some(({ overloaded }) => overloaded)) {
        status = 'Overloaded'
    }
    if (!isPlaying) {
        status = '-'
    }

    // ── Send power data to Kit for whip coloring ─────────────────────────────

    const prevSentRef = useRef<string>("")

    useEffect(() => {
        if (!isPlaying) {
            const resetKey = "reset"
            if (prevSentRef.current !== resetKey) {
                prevSentRef.current = resetKey
                sendPowerFailureData({
                    playing: false,
                    powerA: 0, powerB: 0, powerC: 0, powerD: 0,
                    rppWattage: RPP_KW,
                    failedBusways: 0,
                })
            }
            return
        }

        const powerA = matrix.a.failed ? -1 : matrix.a.power
        const powerB = matrix.b.failed ? -1 : matrix.b.power
        const powerC = matrix.c.failed ? -1 : matrix.c.power
        const powerD = matrix.d.failed ? -1 : matrix.d.power

        const key = `${powerA},${powerB},${powerC},${powerD},${RPP_KW},${failedBusways}`
        if (prevSentRef.current === key) return
        prevSentRef.current = key

        sendPowerFailureData({
            playing: true,
            powerA, powerB, powerC, powerD,
            rppWattage: RPP_KW,
            failedBusways,
        })
    }, [isPlaying, matrix, failedBusways])

    // Sync electrical test state to agent backend
    useEffect(() => {
        syncAgentState({
            electrical_is_running: isPlaying,
            electrical_failed_rpps: failedBusways,
            electrical_load_percent: loadPercent,
            electrical_edp_setting: edpSetting,
        });
    }, [isPlaying, failedBusways, loadPercent, edpSetting])

    // ── Render ───────────────────────────────────────────────────────────────

    return (
        <div className="flex flex-col gap-6 text-sm">
            <p className="text-xs text-muted-foreground leading-relaxed">
                Power Failure: Disable multiple RPPs and adjust the load and EDP settings. Observe how these changes impact the power system&apos;s behavior and whip coloring.
            </p>

            {/* Begin / Stop Test */}
            <div className="flex items-center gap-3">
                {!isPlaying ? (
                    <Button size="sm" variant="outline" onClick={() => setIsPlaying(true)}>
                        Begin Test
                    </Button>
                ) : (
                    <Button size="sm" variant="destructive" onClick={() => setIsPlaying(false)}>
                        Stop Test
                    </Button>
                )}
                <span className="text-xs text-muted-foreground">
                    Status: <span className="text-white font-medium">{status}</span>
                </span>
            </div>

            {/* Controls */}
            <div className="flex flex-col gap-5">
                {/* Fail RPP(s) */}
                <div className="flex items-center gap-3">
                    <Label className="w-[80px] shrink-0 mb-0">Fail RPP(s)</Label>
                    <RadioGroup
                        className="flex flex-row gap-3"
                        value={String(failedBusways)}
                        onValueChange={(v) => setFailedBusways(Number(v))}
                    >
                        {[0, 1, 2, 3, 4].map(n => (
                            <div key={n} className="flex items-center gap-1">
                                <RadioGroupItem value={String(n)} id={`rpp-${n}`} />
                                <Label htmlFor={`rpp-${n}`} className="text-xs mb-0 cursor-pointer">{n}</Label>
                            </div>
                        ))}
                    </RadioGroup>
                </div>

                {/* Load % */}
                <div className="flex items-center gap-3">
                    <Label className="w-[80px] shrink-0 mb-0">Load %</Label>
                    <input
                        type="range"
                        min={0}
                        max={100}
                        value={loadPercent}
                        onChange={(e) => setLoadPercent(Number(e.target.value))}
                        className="flex-1 h-1.5 accent-primary cursor-pointer"
                    />
                    <span className="text-xs w-[32px] text-right tabular-nums">{loadPercent}%</span>
                </div>

                {/* EDP Setting */}
                <div className="flex items-center gap-3">
                    <Label className="w-[80px] shrink-0 mb-0">EDP Setting</Label>
                    <RadioGroup
                        className="flex flex-row gap-3"
                        value={edpSetting}
                        onValueChange={(v) => setEdpSetting(v as '1.2' | '1.5')}
                    >
                        {['1.2', '1.5'].map(v => (
                            <div key={v} className="flex items-center gap-1">
                                <RadioGroupItem value={v} id={`edp-${v}`} />
                                <Label htmlFor={`edp-${v}`} className="text-xs mb-0 cursor-pointer">{v}</Label>
                            </div>
                        ))}
                    </RadioGroup>
                </div>

                {/* Read-only info */}
                <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>RPP Size: <span className="text-white">{RPP_KW} kW</span></span>
                    <span>Feeder: <span className="text-white">{FEEDER}A</span></span>
                </div>
            </div>

            {/* Colour legend */}
            <div className="flex items-center gap-2 py-2 border-y border-white/10 text-xs">
                <div className="text-center">
                    <p className="whitespace-nowrap mb-1">De-Energized</p>
                    <div className="bg-[#00FF00] rounded w-[72px] h-[20px] mx-auto" />
                </div>
                <div className="text-center flex-grow">
                    <p className="whitespace-nowrap mb-1">Energized</p>
                    <div className="h-[20px] rounded" style={{ background: 'linear-gradient(to right, #FFE3E3, #FF0000)' }} />
                </div>
                <div className="text-center">
                    <p className="whitespace-nowrap mb-1">Overloaded</p>
                    <div className="bg-purple-600 rounded w-[72px] h-[20px] mx-auto" />
                </div>
            </div>

            {/* Results table */}
            {!isPlaying && <BlankTable />}
            {isPlaying && (
                <>
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-white/10">
                                <th className="px-3 py-2 text-left w-[100px] font-medium">RPP</th>
                                <th className="px-3 py-2 text-center font-medium">A</th>
                                <th className="px-3 py-2 text-center font-medium">B</th>
                                <th className="px-3 py-2 text-center font-medium">C</th>
                                <th className="px-3 py-2 text-center font-medium">D</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="border-b border-white/5">
                                <td className="px-3 py-2">Ph-Ph (V)</td>
                                <Cell data={matrix.a} valueKey="ph" />
                                <Cell data={matrix.b} valueKey="ph" />
                                <Cell data={matrix.c} valueKey="ph" />
                                <Cell data={matrix.d} valueKey="ph" />
                            </tr>
                            <tr className="border-b border-white/5">
                                <td className="px-3 py-2">Current (A)</td>
                                <Cell data={matrix.a} valueKey="current" canOverload />
                                <Cell data={matrix.b} valueKey="current" canOverload />
                                <Cell data={matrix.c} valueKey="current" canOverload />
                                <Cell data={matrix.d} valueKey="current" canOverload />
                            </tr>
                            <tr>
                                <td className="px-3 py-2">Power (kW)</td>
                                <Cell data={matrix.a} valueKey="power" canOverload />
                                <Cell data={matrix.b} valueKey="power" canOverload />
                                <Cell data={matrix.c} valueKey="power" canOverload />
                                <Cell data={matrix.d} valueKey="power" canOverload />
                            </tr>
                        </tbody>
                    </table>
                    <div className="grid grid-cols-2 items-center text-sm mt-1">
                        <div className="text-right pr-4 py-2 border-r border-white/10">
                            Compute Service Feeder Loading
                        </div>
                        <div className={`py-2 pl-4 ${cellBg({ failed: wipFail, canFail: false, canEnergize: false, canOverload: true, overloaded: wipOverloaded })}`}>
                            {wipFail ? '- %' : `${wipPercent} %`}
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
