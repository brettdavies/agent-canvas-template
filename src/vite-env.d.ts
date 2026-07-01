/// <reference types="vite/client" />

// Fontsource packages export CSS with no JS type declarations; the side-effect
// import is for the @font-face rules only.
declare module '@fontsource-variable/*';
