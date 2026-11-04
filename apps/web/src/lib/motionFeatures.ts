// What makes `m` components move: animation, gestures, drag and layout. main.tsx loads it through import() inside `LazyMotion`,
// so the bulk of motion (drag, layout projection, the animation engine) is not in the first download. Every motion component in
// the app is `m` (imported as `m as motion`); a plain `motion` import would pull all of this back into the first download.
export { domMax as default } from 'motion/react';
