import type { ReactNode } from "react";

type StepStatus = "done" | "current" | "blocked";

export type StepItem = {
  label: ReactNode;
  status: StepStatus;
};

type StepsProps = {
  className?: string;
  steps: StepItem[];
};

export function Steps({ className = "", steps }: StepsProps) {
  const classNames = ["guidance-steps", className].filter(Boolean).join(" ");

  return (
    <ol className={classNames}>
      {steps.map((step, index) => (
        <li
          className={`guidance-step guidance-step-${step.status}`}
          key={index}
        >
          <span className="guidance-step-marker" aria-hidden="true" />
          <span>{step.label}</span>
        </li>
      ))}
    </ol>
  );
}
