package com.kizek.phoneagent

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.core.view.WindowCompat
import com.kizek.phoneagent.ui.AppRoot
import com.kizek.phoneagent.ui.theme.PhoneAgentTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        val app = application as PhoneAgentApplication
        setContent {
            PhoneAgentTheme {
                AppRoot(app)
            }
        }
    }
}
