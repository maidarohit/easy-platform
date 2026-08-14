"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

type StaggerProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
};

export default function Stagger({
  children,
  className = "",
  delay = 0,
}: StaggerProps) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.2 }}
      variants={{
        hidden: {},
        show: {
          transition: {
            delayChildren: delay,
            staggerChildren: 0.12,
          },
        },
      }}
    >
      {children}
    </motion.div>
  );
}