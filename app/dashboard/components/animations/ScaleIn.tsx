"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

type ScaleInProps = {
  children: ReactNode;
  delay?: number;
  className?: string;
};

export default function ScaleIn({
  children,
  delay = 0,
  className = "",
}: ScaleInProps) {
  return (
    <motion.div
      className={className}
      initial={{
        opacity: 0,
        scale: 0.92,
      }}
      whileInView={{
        opacity: 1,
        scale: 1,
      }}
      viewport={{
        once: true,
        amount: 0.25,
      }}
      transition={{
        duration: 0.7,
        delay,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </motion.div>
  );
}