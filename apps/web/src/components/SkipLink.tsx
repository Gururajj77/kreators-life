/** "Skip to main content": the first control a keyboard reaches on an app screen. Out of sight until it has focus, then a pill at the top left. */
export function SkipLink() {
  return (
    <a
      href="#main"
      onClick={(e) => {
        const main = document.getElementById('main');
        if (!main) return;
        e.preventDefault();
        main.focus({ preventScroll: true });
        main.scrollIntoView({ block: 'start' });
      }}
      className="toy toy-soft sr-only rounded-pill bg-card-strong px-md py-sm text-subhead font-medium text-ink focus:not-sr-only focus:inline-flex focus:min-h-[44px] focus:items-center focus:fixed focus:top-sm focus:left-sm focus:z-[60]"
    >
      Skip to main content
    </a>
  );
}
