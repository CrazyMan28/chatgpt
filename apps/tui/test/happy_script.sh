#!/bin/sh

# Happiness Boost Script 🌟
# Description: A fun script to brighten your day!
# Usage: ./happy_script.sh [name or message]

# Check if 'fortune' is installed, suggest installation if not
check_fortune() {
    if ! command -v fortune > /dev/null 2>&1; then
        echo "❕ 'fortune' is not installed. Install it for random quotes!"
        echo "  On Ubuntu/Debian: sudo apt install fortune"
        echo "  On macOS: brew install fortune"
        echo ""
    else
        echo "💡 Run 'fortune' for a random quote!"
        echo ""
    fi
}

# Main script
echo "🌟 Here's your happiness boost! 🌟"
echo ""

# Personalize the message if an argument is provided
if [ $# -gt 0 ]; then
    # Escape special characters to avoid interpretation
    safe_input="$(printf '%s' "$*")"
    if [ -n "$safe_input" ]; then
        echo "  Hello, $safe_input! 🎉"
        echo ""
    else
        echo "  Hello, stranger! 🎉"
        echo ""
    fi
fi

echo "  (\_/)"
echo "  ( •_•)"
echo "  / > 🍪  Have a cookie!"
echo ""
echo "  (^_^)"
echo "  <( )>   Keep smiling!"
echo "   / \\"
echo ""

# Check for fortune
check_fortune

exit 0