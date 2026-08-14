"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

type FloatingProps = {
  children: ReactNode;
  className?: string;
  duration?: number;
  distance?: number;
};

export default function Floating({
  children,
  className = "",
  duration = 4,
  distance = 12,
}: FloatingProps) {
  return (
    <motion.div
      className={className}
      animate={{
        y: [0, -distance, 0],
      }}
      transition={{
        duration,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    >
      {children}
    </motion.div>
  );
}