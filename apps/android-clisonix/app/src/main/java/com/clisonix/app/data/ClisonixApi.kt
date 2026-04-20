package com.clisonix.app.data

import okhttp3.ResponseBody
import retrofit2.Response
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.GET
import retrofit2.http.Url

interface ClisonixApi {
    @GET("v1/ocean-curiosity")
    suspend fun getOceanCuriosity(): Response<ResponseBody>

    @GET
    suspend fun probeEndpoint(@Url absoluteUrl: String): Response<ResponseBody>
}

object ClisonixApiClient {
    val api: ClisonixApi by lazy {
        Retrofit.Builder()
            .baseUrl("https://api.clisonix.com/")
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(ClisonixApi::class.java)
    }
}
