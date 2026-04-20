package com.clisonix.app.data

import com.clisonix.app.data.local.ClisonixDao
import com.clisonix.app.data.local.ModuleHealthEntity
import com.clisonix.app.data.local.OceanCacheEntity
import com.clisonix.app.navigation.PostaModule
import kotlinx.coroutines.flow.Flow
import okhttp3.ResponseBody
import java.io.IOException

class ClisonixRepository(
    private val api: ClisonixApi,
    private val dao: ClisonixDao,
) {
    fun observeOceanCache(): Flow<OceanCacheEntity?> = dao.observeOceanCache()

    fun observeModuleHealth(): Flow<List<ModuleHealthEntity>> = dao.observeModuleHealth()

    suspend fun refreshOceanCuriosity() {
        val response = api.getOceanCuriosity()
        if (!response.isSuccessful) {
            throw IOException("Ocean endpoint failed with HTTP ${response.code()}")
        }

        val payload = response.body()?.string()
            ?: throw IOException("Ocean endpoint returned an empty body")

        dao.upsertOceanCache(
            OceanCacheEntity(
                id = 0,
                payload = payload,
                updatedAtEpochMs = System.currentTimeMillis(),
            ),
        )
    }

    suspend fun refreshModuleHealth(modules: List<PostaModule>) {
        val now = System.currentTimeMillis()
        val checks = modules.map { module ->
            try {
                val response = api.probeEndpoint(module.endpoint)
                ModuleHealthEntity(
                    route = module.route,
                    moduleName = module.name,
                    endpoint = module.endpoint,
                    isHealthy = response.isSuccessful,
                    statusCode = response.code(),
                    errorMessage = null,
                    checkedAtEpochMs = now,
                )
            } catch (ex: Exception) {
                ModuleHealthEntity(
                    route = module.route,
                    moduleName = module.name,
                    endpoint = module.endpoint,
                    isHealthy = false,
                    statusCode = null,
                    errorMessage = ex.message,
                    checkedAtEpochMs = now,
                )
            }
        }

        dao.upsertModuleHealth(checks)
    }
}
