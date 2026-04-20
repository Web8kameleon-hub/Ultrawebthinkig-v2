package com.clisonix.app.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "ocean_cache")
data class OceanCacheEntity(
    @PrimaryKey val id: Int = 0,
    val payload: String,
    val updatedAtEpochMs: Long,
)
