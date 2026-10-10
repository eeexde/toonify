import { buttonPrimary, EmptyState } from "./EmptyState";

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <EmptyState
      role="alert"
      tone="danger"
      icon="alert"
      title="Couldn't load this"
      body={message}
      action={
        onRetry && (
          <button onClick={onRetry} className={buttonPrimary}>
            Try again
          </button>
        )
      }
    />
  );
}
