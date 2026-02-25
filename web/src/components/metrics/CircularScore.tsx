interface CircularScoreProps {
    value: number; // between 0 and 100
    size?: number; // optional, defaults to 100px
    strokeWidth?: number; // optional, defaults to 5px
}

export const CircularScore = ({
    value,
    size = 100,
    strokeWidth = 5,
}: CircularScoreProps) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (value / 100) * circumference;
    const color = value > 90 ? "#0AD287" : value > 70 ? "#FFB41D" : "#FF465F";

    return (
        <div className="flex items-center justify-center relative">
            <svg
                width={size}
                height={size}
                className="transform -rotate-90"
            >
                <circle
                    stroke="#3d3d3d"
                    fill="transparent"
                    strokeWidth={strokeWidth}
                    r={radius}
                    cx={size / 2}
                    cy={size / 2}
                />
                <circle
                    stroke={color}
                    fill="transparent"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    r={radius}
                    cx={size / 2}
                    cy={size / 2}
                    className="transition-all duration-700 ease-in-out"
                />
            </svg>
            <span className="absolute text-white text-xl font-bold">
                {value}
            </span>
        </div>
    );
}
