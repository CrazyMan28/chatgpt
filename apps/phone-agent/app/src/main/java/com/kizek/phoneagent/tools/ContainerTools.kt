package com.kizek.phoneagent.tools

import android.net.Uri
import com.kizek.phoneagent.container.ContainerTerminal
import com.kizek.phoneagent.container.ProotManager

class ContainerTools(
    private val prootManager: ProotManager,
    private val terminal: ContainerTerminal
) {
    fun status() = prootManager.status()
    fun importProot(uri: Uri) = prootManager.importProot(uri)
    fun importRootfs(uri: Uri) = prootManager.importRootfs(uri)
    fun downloadAssets(prootUrl: String, rootfsUrl: String, prootSha256: String = "", rootfsSha256: String = "") =
        prootManager.downloadAssets(prootUrl, rootfsUrl, prootSha256, rootfsSha256)
    fun extractRootfs() = prootManager.extractRootfs()
    fun test() = terminal.test()
    fun exec(command: String) = terminal.exec(command)
    fun stop() = prootManager.stopCommand()
    fun logs(): List<String> = terminal.logs()
    fun clear() = prootManager.clearContainer()
    fun installInstructions(): String = prootManager.installRootfsInstructions()
}
