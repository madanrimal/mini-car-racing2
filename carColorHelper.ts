@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700;900&family=JetBrains+Mono:wght@400;700&display=swap');
@import "tailwindcss";

@theme {
  --font-sans: "Space Grotesk", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, monospace;
}

body {
  margin: 0;
  padding: 0;
  background-color: #09090b;
  overflow: hidden;
  user-select: none;
  -webkit-user-select: none;
}

/* Custom glow utility */
.shadow-glow {
  filter: drop-shadow(0 0 8px rgba(34, 211, 238, 0.65));
}

/* Responsive animations */
@keyframes scaleIn {
  from {
    transform: scale(0.85);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

.scale-in {
  animation: scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
