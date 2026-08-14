"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

type AnimatedButtonProps = {
  children: ReactNode;
  className?: string;
};

export default function AnimatedButton({
  children,
  className = "",
}: AnimatedButtonProps) {
  return (
    <motion.div
      whileHover={{
        scale: 1.05,
        y: -3,
      }}
      whileTap={{
        scale: 0.97,
      }}
      transition={{
        duration: 0.2,
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}