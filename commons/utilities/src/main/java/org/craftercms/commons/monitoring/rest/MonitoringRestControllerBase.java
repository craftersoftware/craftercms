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

package org.craftercms.commons.monitoring.rest;

import jakarta.servlet.http.HttpServletRequest;
import org.apache.commons.lang3.StringUtils;
import org.craftercms.commons.exceptions.InvalidManagementTokenException;
import org.craftercms.commons.monitoring.MemoryInfo;
import org.craftercms.commons.monitoring.StatusInfo;
import org.craftercms.commons.monitoring.SysInfo;
import org.craftercms.commons.monitoring.VersionInfo;
import org.craftercms.commons.rest.ManagementTokenResolver;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;

import static org.apache.commons.lang3.Strings.CS;

/**
 * Base controller for all monitoring related APIs
 *
 * @author joseross
 */
@RestController
public abstract class MonitoringRestControllerBase {

	public final static String ROOT_URL = "/monitoring";
	public final static String MEMORY_URL = "/memory";
	public final static String STATUS_URL = "/status";
	public final static String VERSION_URL = "/version";
	public final static String SYSINFO_URL = "/sysinfo";
	public final static String DISK_URL = "/disk";

	private final String configuredToken;

	public MonitoringRestControllerBase(final String configuredToken) {
		this.configuredToken = configuredToken;
	}

	@GetMapping(ROOT_URL + MEMORY_URL)
	public MemoryInfo getCurrentMemory(HttpServletRequest request) throws InvalidManagementTokenException {
		validateToken(request);
		return MemoryInfo.getCurrentMemory();
	}

	@GetMapping(ROOT_URL + STATUS_URL)
	public ResponseEntity getCurrentStatus(HttpServletRequest request,
					       @RequestParam(name = "site", required = false) String site)
			throws InvalidManagementTokenException {
		validateToken(request);
		return ResponseEntity.ok().body(StatusInfo.getCurrentStatus());
	}

	@GetMapping(ROOT_URL + VERSION_URL)
	public ResponseEntity getCurrentVersion(HttpServletRequest request)
			throws InvalidManagementTokenException, IOException {
		validateToken(request);
		return ResponseEntity.ok().body(VersionInfo.getVersion(this.getClass()));
	}

	@GetMapping(ROOT_URL + SYSINFO_URL)
	public ResponseEntity getCurrentSysInfo(HttpServletRequest request)
			throws InvalidManagementTokenException, IOException {
		validateToken(request);
		return ResponseEntity.ok().body(SysInfo.getInfo(this.getClass()));
	}

	/**
	 * Accepts {@code X-Crafter-Management-Token} and, when that header is absent, the {@code token} query parameter.
	 */
	protected final void validateToken(HttpServletRequest request) throws InvalidManagementTokenException {
		String requestToken = ManagementTokenResolver.resolve(request);
		if (StringUtils.isEmpty(requestToken) || !CS.equals(requestToken, configuredToken)) {
			throw new InvalidManagementTokenException("Management authorization failed, invalid token.");
		}
	}

}
