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
import org.apache.commons.lang3.BooleanUtils
import upgrade.exceptions.UpgradeException
import upgrade.hooks.PostUpgradeHook

import java.nio.file.Path

import okhttp3.*

import static utils.EnvironmentUtils.getDeployerUrl
import static utils.EnvironmentUtils.getEnv

class RecreateIndexesHook implements PostUpgradeHook {

    @Override
    void execute(Path binFolder, Path dataFolder, String environment) {
        println "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"
        println "Re-creating Search indexes for sites"
        println "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"

        println "WARNING: This will delete the current Search site indexes and recreate them."
        println "This is necessary because of a major Search upgrade. Don't proceed "
        println "if you can't have any search downtime."

        def cont = System.console().readLine '> Proceed? [(Y)es/(N)o]: '
        cont = BooleanUtils.toBoolean(cont)

        if (cont) {
            def targets = getAllTargets()
            targets.each { target ->
                recreateIndex(target.site_name, target.env)
            }
        }
    }

    protected def getAllTargets() {
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

    protected void recreateIndex(String siteName, String environment) {
        OkHttpClient client = new OkHttpClient()

        HttpUrl.Builder urlBuilder = HttpUrl
                .parse("${getDeployerUrl()}/api/1/target/recreate/${environment}/${siteName}")
                .newBuilder()
        urlBuilder.addQueryParameter('token', getEnv('DEPLOYER_MANAGEMENT_TOKEN'))

        Request request = new Request.Builder()
                .url(urlBuilder.build())
                .post(RequestBody.create(null, new byte[0]))
                .addHeader('Content-Type', 'application/json')
                .build()
        try {
            Response response = client.newCall(request).execute();
            if (response.successful) {
                println "Re-index successfully triggered for '${siteName}-${environment}'"
            } else {
                throw new UpgradeException("Error while triggering re-index for '${siteName}-${environment}':${response.message()}")
            }
        } catch (IOException e) {
            e.printStackTrace()
        }
    }
}
