/*
 * Copyright (C) 2007-2025 Crafter Software Corporation. All Rights Reserved.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as published by
 * the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
package upgrade.hooks

@Grapes([
	@Grab(group='com.squareup.okhttp3', module='okhttp-jvm', version='5.3.2')
])

import groovy.json.JsonSlurper
import groovy.json.JsonBuilder
import java.nio.file.Path
import okhttp3.*
import static utils.EnvironmentUtils.getDeployerUrl
import upgrade.exceptions.UpgradeException

class ReindexAllTargetsHook implements PostUpgradeHook {

    def getAllTargets() {
        OkHttpClient client = new OkHttpClient()

        Request request = new Request.Builder()
                .url("${getDeployerUrl()}/api/1/target/get-all")
                .get()
                .addHeader('Content-Type', 'application/json')
                .build()
        try (Response response = client.newCall(request).execute()) {
            if (!response.successful) {
                throw new UpgradeException("Error while listing targets: ${response.message()}")
            }

            return (new JsonSlurper()).parseText(response.body().string())
        } catch (IOException e) {
            e.printStackTrace()
        }
    }

    void deployAll() {
        OkHttpClient client = new OkHttpClient()

        def deployAllParams = [
            'reprocess_all_files': true,
            'deployment_mode'    : 'SEARCH_INDEX'
        ]

        MediaType mediaType = MediaType.parse('application/json')
        RequestBody body = RequestBody.create(new JsonBuilder(deployAllParams).toString(), mediaType)
        Request request = new Request.Builder()
                .url("${getDeployerUrl()}/api/1/target/deploy-all")
                .post(body)
                .addHeader('Content-Type', 'application/json')
                .build()
        try {
            Response response = client.newCall(request).execute();
            if (response.successful) {
                println "'deploy-all' API triggered successfully"
            } else {
                println "Failed to trigger 'deploy-all' API: ${response.message()}"
            }
        } catch (IOException e) {
            e.printStackTrace()
        }
    }

    @Override
    void execute(Path binFolder, Path dataFolder, String environment) {
        println "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"
        println "Reindex all targets"
        println "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"

        def targets = getAllTargets()
        if (!targets) {
            println "No target found. Nothing to reindex"
        }

        println "${targets.size()} targets were found. Calling deployer 'deploy-all' API"
        deployAll()
    }

}
