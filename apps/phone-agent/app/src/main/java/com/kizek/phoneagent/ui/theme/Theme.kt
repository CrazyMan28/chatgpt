package com.kizek.phoneagent.ui.theme

import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val DarkScheme: ColorScheme = darkColorScheme(
    primary = Color(0xFF8DEBD5),
    onPrimary = Color(0xFF05211D),
    primaryContainer = Color(0xFF12433B),
    onPrimaryContainer = Color(0xFFB9FFF0),
    secondary = Color(0xFFFFC86B),
    onSecondary = Color(0xFF2A1A00),
    secondaryContainer = Color(0xFF5B410B),
    onSecondaryContainer = Color(0xFFFFE1A8),
    tertiary = Color(0xFFC7B9FF),
    onTertiary = Color(0xFF21144D),
    tertiaryContainer = Color(0xFF3D316E),
    onTertiaryContainer = Color(0xFFE5DEFF),
    background = Color(0xFF090B0F),
    onBackground = Color(0xFFECEFF4),
    surface = Color(0xFF10131A),
    onSurface = Color(0xFFECEFF4),
    surfaceVariant = Color(0xFF1A202B),
    onSurfaceVariant = Color(0xFFC4CAD5),
    outline = Color(0xFF566070),
    outlineVariant = Color(0xFF2E3542),
    error = Color(0xFFFFB4AB),
    onError = Color(0xFF690005),
    errorContainer = Color(0xFF5D1E22),
    onErrorContainer = Color(0xFFFFDAD6)
)

@Composable
fun PhoneAgentTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = DarkScheme,
        typography = MaterialTheme.typography,
        content = content
    )
}
