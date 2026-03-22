interface CostBadgeProps {
  cost: number;
  className?: string;
}

export default function CostBadge({ cost, className = '' }: CostBadgeProps) {
  const formatted = cost < 0.000001
    ? '$0.000000'
    : `$${cost.toFixed(6)}`;

  return (
    <span
      className={`font-mono text-sm font-semibold text-[#00c853] ${className}`}
      title={`$${cost}`}
    >
      {formatted}
    </span>
  );
}
