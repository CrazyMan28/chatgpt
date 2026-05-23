#!/usr/bin/env node

/**
 * A simple "rocket ship" ASCII animation for the `spac` command.
 * Clears the terminal, displays a rocket ascending, and exits cleanly.
 */

import clear from 'clear';
import figlet from 'figlet';

// Clear the terminal
clear();

// ASCII rocket animation
const frames = [
  '      /\      ',
  '     /  \     ',
  '    /    \    ',
  '   /______\   ',
  '    |    |    ',
  '    |____|    ',
  '     |  |     ',
  '     |__|     ',
  '     /  \     ',
  '    /    \    ',
  '   /      \   ',
  '  /        \  ',
  ' /__________\ ',
  '      ||      ',
  '      ||      ',
  '      ||      ',
];

// Animation loop
const animateRocket = () => {
  const interval = setInterval(() => {
    clear();
    console.log(figlet.textSync('ROCKET', { horizontalLayout: 'full' }));
    console.log('Launching...\n');
    frames.forEach((frame) => console.log(frame));
  }, 200);

  // Stop after 3 seconds and exit
  setTimeout(() => {
    clearInterval(interval);
    clear();
    console.log(figlet.textSync('BLAST OFF!', { horizontalLayout: 'full' }));
    process.exit(0);
  }, 3000);
};

// Start animation
animateRocket();
