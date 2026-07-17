"use client";

import { useEffect, useState } from "react";

type AnimatedValueProps = {
  value: number;
  duration?: number;
  formatter?: (value: number) => string;
  className?: string;
};

export default function AnimatedValue({
  value,
  duration = 700,
  formatter = (currentValue) => Math.round(currentValue).toLocaleString("tr-TR"),
  className = "",
}: AnimatedValueProps) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let frameId = 0;
    const startedAt = performance.now();
    const startValue = displayValue;

    const update = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(startValue + (value - startValue) * easedProgress);

      if (progress < 1) frameId = requestAnimationFrame(update);
    };

    frameId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frameId);
    // displayValue intentionally omitted: each new value animates from the visible value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  return <span className={`ayca-animated-value ${className}`.trim()}>{formatter(displayValue)}</span>;
}