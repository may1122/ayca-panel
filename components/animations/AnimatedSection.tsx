"use client";

import type { ReactNode } from "react";

type AnimatedPageProps = {
  children: ReactNode;
  animationKey?: string;
  className?: string;
};

export default function AnimatedPage({ children, animationKey, className = "" }: AnimatedPageProps) {
  return (
    <div key={animationKey} className={`ayca-animated-page ${className}`.trim()}>
      {children}
    </div>
  );
}