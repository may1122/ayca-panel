"use client";

import type { ReactNode } from "react";

type AnimatedTableProps = {
  children: ReactNode;
  className?: string;
};

export default function AnimatedTable({ children, className = "" }: AnimatedTableProps) {
  return <div className={`ayca-animated-table ${className}`.trim()}>{children}</div>;
}