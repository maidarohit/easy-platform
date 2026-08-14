"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

type SlideUpProps = {
  children: ReactNode;
  delay?: number;
  className?: string;
};

export default function SlideUp({
  children,
  delay = 0,
  className = "",
}: SlideUpProps) {
  return (
    <motion.div
      className={className}
      initial={{
        opacity: 0,
        y: 60,
      }}
      whileInView={{
        opacity: 1,
        y: 0,
      }}
      viewport={{
        once: true,
        amount: 0.25,
      }}
      transition={{
        duration: 0.8,
        delay,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </motion.div>
  );
}