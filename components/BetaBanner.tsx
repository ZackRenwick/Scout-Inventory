interface BetaBannerProps {
  featureName: string;
  message?: string;
}

export default function BetaBanner({ featureName, message }: BetaBannerProps) {
  return (
    <div class="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg text-amber-800 dark:text-amber-300 text-sm">
      <span>
        🚧 <strong>Beta feature</strong> — {message ?? `${featureName} is still in development. Please report any issues.`}
      </span>
    </div>
  );
}
