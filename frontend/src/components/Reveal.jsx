import { motion } from "framer-motion";

export const Reveal = ({ children, delay = 0, className = "", y = 36 }) => (
  <motion.div
    className={className}
    initial={{ opacity: 0, y }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-70px" }}
    transition={{ duration: 0.75, delay, ease: [0.22, 1, 0.36, 1] }}
  >
    {children}
  </motion.div>
);

export const SectionHeading = ({ title, subtitle, center = true }) => (
  <Reveal className={`mb-12 ${center ? "text-center" : ""}`}>
    <div className={`flex items-center gap-4 ${center ? "justify-center" : ""}`}>
      <span className="hidden h-px w-16 bg-gradient-to-r from-transparent to-[#D4AF37] sm:block" />
      <h2 className="font-display text-2xl font-bold tracking-tight text-gold-gradient sm:text-3xl lg:text-4xl">
        {title}
      </h2>
      <span className="hidden h-px w-16 bg-gradient-to-l from-transparent to-[#D4AF37] sm:block" />
    </div>
    {subtitle && (
      <p className="mt-4 text-base text-slate-400 sm:text-lg">{subtitle}</p>
    )}
  </Reveal>
);
