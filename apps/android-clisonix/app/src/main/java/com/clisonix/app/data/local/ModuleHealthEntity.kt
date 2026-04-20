package com.clisonix.app.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "module_health")
data class ModuleHealthEntity(
    @PrimaryKey val route: String,
    val moduleName: String,
    val endpoint: String,
    val isHealthy: Boolean,
    val statusCode: Int?,
    val errorMessage: String?,
    val checkedAtEpochMs: Long,
)
