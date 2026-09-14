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

package org.craftercms.studio.controller.rest.v2;

import jakarta.validation.constraints.Positive;
import org.craftercms.commons.exceptions.InvalidManagementTokenException;
import org.craftercms.commons.monitoring.MemoryInfo;
import org.craftercms.commons.monitoring.StatusInfo;
import org.craftercms.commons.monitoring.SysInfo;
import org.craftercms.commons.monitoring.VersionInfo;
import org.craftercms.studio.api.v2.exception.InvalidParametersException;
import org.craftercms.studio.api.v2.service.monitor.MonitorService;
import org.craftercms.studio.api.v2.utils.StudioConfiguration;
import org.craftercms.studio.model.rest.ApiResponse;
import org.craftercms.studio.model.rest.Result;
import org.craftercms.studio.model.rest.ResultList;
import org.craftercms.studio.model.rest.ResultOne;
import org.craftercms.studio.model.rest.monitoring.DiskStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.beans.ConstructorProperties;
import java.io.IOException;
import java.util.Map;

import static org.craftercms.commons.monitoring.rest.MonitoringRestControllerBase.*;
import static org.craftercms.engine.controller.rest.MonitoringController.LOG_URL;
import static org.craftercms.studio.controller.rest.v2.RequestConstants.REQUEST_PARAM_TOKEN;
import static org.craftercms.studio.controller.rest.v2.ResultConstants.*;
import static org.springframework.http.MediaType.APPLICATION_JSON_VALUE;

/**
 * Rest controller to provide monitoring information
 *
 * @author joseross
 */
@Validated
@RestController
@RequestMapping("/api/2")
public class MonitoringController extends ManagementTokenAware {

	protected final MonitorService monitorService;

	@ConstructorProperties({"studioConfiguration", "monitorService"})
	public MonitoringController(StudioConfiguration studioConfiguration, MonitorService monitorService) {
		super(studioConfiguration);
		this.monitorService = monitorService;
	}

	@GetMapping(value = ROOT_URL + MEMORY_URL, produces = APPLICATION_JSON_VALUE)
	public ResultOne<MemoryInfo> getCurrentMemory(@RequestParam(name = "token") String token)
			throws InvalidManagementTokenException, InvalidParametersException {
		validateToken(token, true);
		ResultOne<MemoryInfo> result = new ResultOne<>();
		result.setResponse(ApiResponse.OK);
		result.setEntity(RESULT_KEY_MEMORY, MemoryInfo.getCurrentMemory());
		return result;
	}

	@GetMapping(value = ROOT_URL + STATUS_URL, produces = APPLICATION_JSON_VALUE)
	public ResultOne<StatusInfo> getCurrentStatus(@RequestParam(name = "token") String token)
			throws InvalidManagementTokenException, InvalidParametersException {
		validateToken(token, true);
		ResultOne<StatusInfo> result = new ResultOne<>();
		result.setResponse(ApiResponse.OK);
		result.setEntity(RESULT_KEY_STATUS, StatusInfo.getCurrentStatus());
		return result;
	}

	@GetMapping(value = ROOT_URL + VERSION_URL, produces = APPLICATION_JSON_VALUE)
	public ResultOne<VersionInfo> getCurrentVersion(@RequestParam(name = "token", required = false) String token)
			throws InvalidManagementTokenException, IOException, InvalidParametersException {
		validateToken(token);
		ResultOne<VersionInfo> result = new ResultOne<>();
		result.setResponse(ApiResponse.OK);
		result.setEntity(RESULT_KEY_VERSION, VersionInfo.getVersion(getClass()));
		return result;
	}

	@GetMapping(value = ROOT_URL + SYSINFO_URL, produces = APPLICATION_JSON_VALUE)
	public ResultOne<SysInfo> getCurrentSysInfo(@RequestParam(name = REQUEST_PARAM_TOKEN) String token)
			throws InvalidManagementTokenException, IOException, InvalidParametersException {
		validateToken(token, true);
		ResultOne<SysInfo> result = new ResultOne<>();
		result.setResponse(ApiResponse.OK);
		result.setEntity(RESULT_KEY_SYSINFO, SysInfo.getInfo(getClass()));
		return result;
	}

	@GetMapping(value = ROOT_URL + LOG_URL, produces = APPLICATION_JSON_VALUE)
	public ResultList<Map<String, Object>> getLogEvents(@Positive @RequestParam long since,
														@RequestParam(name = "token", required = false) String token)
			throws InvalidManagementTokenException, InvalidParametersException {
		validateToken(token);
		ResultList<Map<String, Object>> result = new ResultList<>();
		result.setResponse(ApiResponse.OK);
		result.setEntities(RESULT_KEY_EVENTS, monitorService.getLogEvents("craftercms", since));
		return result;
	}

	@GetMapping(value = ROOT_URL + DISK_URL, produces = APPLICATION_JSON_VALUE)
	public Result getDiskInfo(@RequestParam(name = REQUEST_PARAM_TOKEN) String token)
			throws InvalidParametersException, InvalidManagementTokenException {
		validateToken(token, true);
		ResultOne<DiskStatus> result = new ResultOne<>();
		result.setEntity(RESULT_KEY_DISK, monitorService.getDiskUsage());
		result.setResponse(ApiResponse.OK);
		return result;
	}

}
