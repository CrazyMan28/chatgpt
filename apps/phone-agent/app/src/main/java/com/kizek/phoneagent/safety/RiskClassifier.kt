package com.kizek.phoneagent.safety

class RiskClassifier {
    fun classify(action: String): String {
        val lowered = action.lowercase()
        return when {
            listOf("password", "bank", "payment", "wire transfer").any { lowered.contains(it) } -> "high"
            listOf("delete", "rm ", "tap", "swipe", "type").any { lowered.contains(it) } -> "medium"
            else -> "low"
        }
    }
}
