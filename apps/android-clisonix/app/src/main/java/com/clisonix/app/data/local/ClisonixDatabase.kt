package com.clisonix.app.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(
    entities = [OceanCacheEntity::class, ModuleHealthEntity::class],
    version = 1,
    exportSchema = false,
)
abstract class ClisonixDatabase : RoomDatabase() {
    abstract fun dao(): ClisonixDao

    companion object {
        @Volatile
        private var instance: ClisonixDatabase? = null

        fun get(context: Context): ClisonixDatabase {
            return instance ?: synchronized(this) {
                instance ?: Room.databaseBuilder(
                    context.applicationContext,
                    ClisonixDatabase::class.java,
                    "clisonix-db",
                ).build().also { instance = it }
            }
        }
    }
}
