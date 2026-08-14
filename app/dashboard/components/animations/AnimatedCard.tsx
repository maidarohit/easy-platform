"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

type AnimatedCardProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
};

export default function AnimatedCard({
  children,
  className = "",
  delay = 0,
}: AnimatedCardProps) {
  return (
    <motion.div
      className={className}
      initial={{
        opacity: 0,
        y: 30,
        scale: 0.97,
      }}
      whileInView={{
        opacity: 1,
        y: 0,
        scale: 1,
      }}
      whileHover={{
        y: -8,
        scale: 1.02,
      }}
      viewport={{
        once: true,
        amount: 0.2,
      }}
      transition={{
        duration: 0.5,
        delay,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </motion.div>
  );
}