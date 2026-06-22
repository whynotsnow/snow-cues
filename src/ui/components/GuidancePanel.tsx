import type { GuidanceAction, GuidanceCard, UserGuidance } from "../guidance";

type GuidancePanelProps = {
  guidance: UserGuidance;
  onAction: (action: GuidanceAction) => void;
};

export function GuidancePanel({ guidance, onAction }: GuidancePanelProps) {
  return (
    <section className="guidance-panel" aria-label="用户操作指引">
      {guidance.cards.map((card, index) => (
        <GuidanceCardView card={card} isPrimary={index === 0} key={card.id} onAction={onAction} />
      ))}
    </section>
  );
}

type GuidanceCardViewProps = {
  card: GuidanceCard;
  isPrimary: boolean;
  onAction: (action: GuidanceAction) => void;
};

function GuidanceCardView({ card, isPrimary, onAction }: GuidanceCardViewProps) {
  const cardClassName = [
    "guidance-card",
    isPrimary ? "guidance-card-primary" : "guidance-card-secondary",
    card.status === "blocked" ? "guidance-card-blocked" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article className={cardClassName}>
      <div className="guidance-header">
        <span>{getGuidanceCardEyebrow(card, isPrimary)}</span>
        <h2>{card.title}</h2>
        <p>{card.body}</p>
      </div>
      {card.steps.length > 0 ? (
        <ol className="guidance-steps">
          {card.steps.map((step) => (
            <li className={`guidance-step guidance-step-${step.status}`} key={step.label}>
              <span className="guidance-step-marker" aria-hidden="true" />
              <span>{step.label}</span>
            </li>
          ))}
        </ol>
      ) : null}
      {card.blockedReason ? <p className="guidance-blocked">{card.blockedReason}</p> : null}
      <div className="guidance-actions">
        {card.primaryAction ? (
          <button className={isPrimary ? "primary-button" : undefined} onClick={() => onAction(card.primaryAction!)} type="button">
            {card.primaryAction.label}
          </button>
        ) : null}
        {card.secondaryAction ? (
          <button onClick={() => onAction(card.secondaryAction!)} type="button">
            {card.secondaryAction.label}
          </button>
        ) : null}
      </div>
    </article>
  );
}

function getGuidanceCardEyebrow(card: GuidanceCard, isPrimary: boolean) {
  if (card.status === "blocked") {
    return "受阻流程";
  }
  if (card.status === "ready") {
    return "可用操作";
  }
  if (isPrimary) {
    return "下一步";
  }
  return "相关流程";
}
