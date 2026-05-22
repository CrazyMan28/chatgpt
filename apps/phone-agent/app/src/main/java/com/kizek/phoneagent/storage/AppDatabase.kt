package com.kizek.phoneagent.storage

import android.content.Context
import androidx.room.ColumnInfo
import androidx.room.Database
import androidx.room.Entity
import androidx.room.PrimaryKey
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

@Entity(tableName = "sessions")
data class SessionEntity(
    @PrimaryKey val id: String,
    val title: String,
    val worker: String,
    val mode: String,
    val updatedAt: Long,
    val remote: Boolean = false
)

@Entity(tableName = "events")
data class EventEntity(
    @PrimaryKey val id: String,
    val sessionId: String,
    val type: String,
    val author: String,
    val summary: String,
    val payload: String,
    val createdAt: Long
)

@Entity(tableName = "tasks")
data class TaskEntity(
    @PrimaryKey val id: String,
    val sessionId: String,
    val title: String,
    val state: String,
    val step: String,
    val worker: String,
    val createdAt: Long,
    val updatedAt: Long
)

@Entity(tableName = "approvals")
data class ApprovalEntity(
    @PrimaryKey val id: String,
    val sessionId: String,
    val action: String,
    val tool: String,
    val risk: String,
    val worker: String,
    val scope: String,
    val reason: String,
    val target: String,
    val status: String,
    val createdAt: Long
)

@Entity(tableName = "questions")
data class QuestionEntity(
    @PrimaryKey val id: String,
    val sessionId: String,
    val prompt: String,
    @ColumnInfo(defaultValue = "") val title: String = "",
    @ColumnInfo(defaultValue = "") val description: String = "",
    val type: String,
    val optionsCsv: String,
    @ColumnInfo(defaultValue = "1") val allowCustom: Boolean = true,
    @ColumnInfo(defaultValue = "1") val allowSkip: Boolean = true,
    @ColumnInfo(defaultValue = "runtime") val source: String = "runtime",
    val relatedTaskId: String? = null,
    @ColumnInfo(defaultValue = "-1") val relatedStepIndex: Int = -1,
    val answer: String?,
    val status: String,
    @ColumnInfo(defaultValue = "pending") val state: String = status,
    val createdAt: Long,
    val answeredAt: Long? = null
) {
    val options: List<String>
        get() = optionsCsv.split("|").filter { it.isNotBlank() }
}

@Entity(tableName = "memory")
data class MemoryEntity(
    @PrimaryKey val key: String,
    val value: String,
    val updatedAt: Long
)

@Database(
    entities = [
        SessionEntity::class,
        EventEntity::class,
        TaskEntity::class,
        ApprovalEntity::class,
        QuestionEntity::class,
        MemoryEntity::class
    ],
    version = 2,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun sessions(): SessionDao
    abstract fun events(): EventDao
    abstract fun tasks(): TaskDao
    abstract fun approvals(): ApprovalDao
    abstract fun questions(): QuestionDao
    abstract fun memory(): MemoryDao

    companion object {
        @Volatile private var instance: AppDatabase? = null

        private val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE questions ADD COLUMN title TEXT NOT NULL DEFAULT ''")
                db.execSQL("ALTER TABLE questions ADD COLUMN description TEXT NOT NULL DEFAULT ''")
                db.execSQL("ALTER TABLE questions ADD COLUMN allowCustom INTEGER NOT NULL DEFAULT 1")
                db.execSQL("ALTER TABLE questions ADD COLUMN allowSkip INTEGER NOT NULL DEFAULT 1")
                db.execSQL("ALTER TABLE questions ADD COLUMN source TEXT NOT NULL DEFAULT 'runtime'")
                db.execSQL("ALTER TABLE questions ADD COLUMN relatedTaskId TEXT")
                db.execSQL("ALTER TABLE questions ADD COLUMN relatedStepIndex INTEGER NOT NULL DEFAULT -1")
                db.execSQL("ALTER TABLE questions ADD COLUMN state TEXT NOT NULL DEFAULT 'pending'")
                db.execSQL("ALTER TABLE questions ADD COLUMN answeredAt INTEGER")
            }
        }

        fun get(context: Context): AppDatabase {
            return instance ?: synchronized(this) {
                instance ?: Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "phone-agent.db"
                )
                    .addMigrations(MIGRATION_1_2)
                    .build()
                    .also { instance = it }
            }
        }
    }
}
