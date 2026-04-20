package com.clisonix.app.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface ClisonixDao {
    @Query("SELECT * FROM ocean_cache WHERE id = 0 LIMIT 1")
    fun observeOceanCache(): Flow<OceanCacheEntity?>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertOceanCache(cache: OceanCacheEntity)

    @Query("SELECT * FROM module_health ORDER BY moduleName ASC")
    fun observeModuleHealth(): Flow<List<ModuleHealthEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertModuleHealth(items: List<ModuleHealthEntity>)
}
