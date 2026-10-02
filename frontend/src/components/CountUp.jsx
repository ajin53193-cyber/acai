import { useEffect, useRef, useState } from "react";
import { animate, useInView } from "framer-motion";

export const CountUp = ({ value }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const target = parseInt(value, 10);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView || Number.isNaN(target)) return;
    const controls = animate(0, target, {
      duration: 1.8,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [inView, target]);

  if (Number.isNaN(target)) return <span ref={ref}>{value}</span>;
  return <span ref={ref}>{display}</span>;
};
