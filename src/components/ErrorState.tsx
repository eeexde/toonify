export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <p className="text-muted">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-fg">
          Try again
        </button>
      )}
    </div>
  );
}
