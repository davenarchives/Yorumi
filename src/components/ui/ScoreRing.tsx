export default function ScoreRing({ score }: { score: number }) {
    const size = 42;
    const strokeWidth = 2.6;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const percentage = Math.min(1, Math.max(0.1, score / 10));
    const strokeDashoffset = circumference * (1 - percentage);

    return (
        <div className="relative inline-flex items-center justify-center w-[42px] h-[42px] rounded-full bg-black/50 shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox={`0 0 ${size} ${size}`}>
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="rgba(255, 255, 255, 0.15)"
                    strokeWidth={strokeWidth}
                />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="#22c55e"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                />
            </svg>
            <span className="absolute text-white font-bold text-[14px] tracking-tight">
                {score.toFixed(1)}
            </span>
        </div>
    );
}

