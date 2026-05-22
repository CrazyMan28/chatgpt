package com.kizek.phoneagent.safety

class SafetyPolicy(
    private val riskClassifier: RiskClassifier = RiskClassifier()
) {
    fun requiresApproval(tool: String, action: String): Boolean {
        if (tool.startsWith("phone_accessibility") || tool.contains("tap") || tool.contains("type")) {
            return true
        }
        return riskClassifier.classify(action) != "low"
    }

    fun reason(tool: String, action: String): String {
        return "Risk ${riskClassifier.classify(action)} for $tool. Phone actions require visible user approval."
    }
}
