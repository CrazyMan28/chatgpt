#!/bin/sh

# Happiness Boost Script 🌟
# Description: A *supercharged* script to brighten your day!
# Usage: ./newhappy.sh [name]

# --- Colors for fun! ---
init_colors() {
    RED=$(tput setaf 1)
    GREEN=$(tput setaf 2)
    YELLOW=$(tput setaf 3)
    BLUE=$(tput setaf 4)
    MAGENTA=$(tput setaf 5)
    CYAN=$(tput setaf 6)
    BOLD=$(tput bold)
    RESET=$(tput sgr0)
}

# --- Random compliments ---
compliments=(
    "${BOLD}${GREEN}You’re amazing!${RESET}"
    "${BOLD}${MAGENTA}You make the world brighter!${RESET}"
    "${BOLD}${CYAN}You’re a coding superstar!${RESET}"
    "${BOLD}${YELLOW}You’re unstoppable!${RESET}"
    "${BOLD}${BLUE}You’re awesome just the way you are!${RESET}"
)

# --- Check for 'fortune' ---
check_fortune() {
    if command -v fortune > /dev/null 2>&1; then
        echo "${BOLD}${BLUE}💬 Random wisdom for you:${RESET}"
        echo "  $(fortune | fmt -w 60 | sed 's/^/  /')"
        echo ""
    else
        echo "${YELLOW}❕ 'fortune' not found. Install it for random quotes!${RESET}"
        echo "  Ubuntu/Debian: ${CYAN}sudo apt install fortune${RESET}"
        echo "  macOS:         ${CYAN}brew install fortune${RESET}"
        echo ""
    fi
}

# --- Main script ---
init_colors

echo "${BOLD}${MAGENTA}🌟 === HAPPINESS BOOST ACTIVATED! === 🌟${RESET}"
echo ""

# --- Personal greeting ---
if [ $# -gt 0 ]; then
    name="$*"
else
    echo "${CYAN}What’s your name? ${RESET}"
    read -r name
fi

if [ -n "$name" ]; then
    echo "${GREEN}  Hello, ${BOLD}${YELLOW}$name${RESET}${GREEN}! 🎉${RESET}"
else
    echo "${GREEN}  Hello, ${BOLD}${YELLOW}stranger${RESET}${GREEN}! 🎉${RESET}"
fi
echo ""

# --- Random compliment ---
echo "${BOLD}${BLUE}💖 Today’s compliment:${RESET}"
echo "  ${compliments[$((RANDOM % ${#compliments[@]}))]}"
echo ""

# --- ASCII art ---
echo "${BOLD}${MAGENTA}  (\/_)\\_____/${RESET}"
echo "${BOLD}${MAGENTA}  ( •_• )${RESET}"
echo "${BOLD}${MAGENTA}  / >🍪${RESET} ${YELLOW}Here’s a cookie for you!${RESET}"
echo ""
echo "${BOLD}${CYAN}  (^_^)${RESET}"
echo "${BOLD}${CYAN}  <( )>  Keep smiling!${RESET}"
echo "${BOLD}${CYAN}   / \\${RESET}"
echo ""

# --- Fortune check ---
check_fortune

# --- Goodbye ---
echo "${BOLD}${GREEN}🌈 Have a wonderful day! 🌈${RESET}"
echo ""