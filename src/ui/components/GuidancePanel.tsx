import type { GuidanceAction, GuidanceCard, UserGuidance } from "../guidance";

type GuidancePanelProps = {
  guidance: UserGuidance;
  onAction: (action: GuidanceAction) => void;
};

export function GuidancePanel({ guidance, onAction }: GuidancePanelProps) {
  return (
    <section className="guidance-panel" aria-label="用户操作指引">
      {guidance.cards.map((card, index) => (
        <GuidanceCardView
          card={card}
          isPrimary={index === 0}
          key={card.id}
          onAction={onAction}
        />
      ))}
    </section>
  );
}

type GuidanceCardViewProps = {
  card: GuidanceCard;
  isPrimary: boolean;
  onAction: (action: GuidanceAction) => void;
};

function GuidanceCardView({
  card,
  isPrimary,
  onAction
}: GuidanceCardViewProps) {
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
            <li
              className={`guidance-step guidance-step-${step.status}`}
              key={step.label}
            >
              <span className="guidance-step-marker" aria-hidden="true" />
              <span>{step.label}</span>
            </li>
          ))}
        </ol>
      ) : null}
      {card.blockedReason ? (
        <p className="guidance-blocked">{card.blockedReason}</p>
      ) : null}
      <div className="guidance-actions">
        {card.primaryAction ? (
          <GuidanceActionControl
            action={card.primaryAction}
            isPrimary={isPrimary}
            onAction={onAction}
          />
        ) : null}
        {card.secondaryAction ? (
          <GuidanceActionControl
            action={card.secondaryAction}
            isPrimary={false}
            onAction={onAction}
          />
        ) : null}
      </div>
    </article>
  );
}

type GuidanceActionControlProps = {
  action: GuidanceAction;
  isPrimary: boolean;
  onAction: (action: GuidanceAction) => void;
};

function GuidanceActionControl({
  action,
  isPrimary,
  onAction
}: GuidanceActionControlProps) {
  const className = isPrimary ? "primary-button" : undefined;

  if (action.type === "external-link") {
    return (
      <a
        className={className ? `button-link ${className}` : "button-link"}
        href={action.href}
        rel="noreferrer"
        target="_blank"
      >
        {action.label}
      </a>
    );
  }

  return (
    <button
      className={className}
      onClick={() => onAction(action)}
      type="button"
    >
      {action.label}
    </button>
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
