/*
 * Copyright (C) 2007-2023 Crafter Software Corporation. All Rights Reserved.
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

import org.craftercms.studio.api.v1.exception.ServiceLayerException;
import org.craftercms.studio.api.v2.service.security.AccessTokenService;
import org.craftercms.studio.api.v2.service.security.EncryptionService;
import org.craftercms.studio.model.rest.*;
import org.craftercms.studio.model.rest.security.EncryptRequest;
import org.craftercms.studio.model.security.PersistentAccessToken;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;

import java.beans.ConstructorProperties;

import static org.craftercms.studio.controller.rest.v2.ResultConstants.*;
import static org.springframework.http.MediaType.APPLICATION_JSON_VALUE;

/**
 * Rest controller that provides access to security operations
 *
 * @author joseross
 * @since 3.1.5
 */
@RestController
@RequestMapping("/api/2/security")
public class SecurityController {

	protected EncryptionService encryptionService;

	protected AccessTokenService accessTokenService;

	@ConstructorProperties({"encryptionService", "accessTokenService"})
	public SecurityController(EncryptionService encryptionService, AccessTokenService accessTokenService) {
		this.encryptionService = encryptionService;
		this.accessTokenService = accessTokenService;
	}

	@PostMapping(value = "/encrypt", consumes = APPLICATION_JSON_VALUE, produces = APPLICATION_JSON_VALUE)
	public ResultOne<String> encryptText(@Valid @RequestBody EncryptRequest request) throws ServiceLayerException {
		String encrypted = encryptionService.encrypt(request.getSiteId(), request.getText());

		ResultOne<String> result = new ResultOne<>();
		result.setEntity(RESULT_KEY_ITEM, encrypted);
		result.setResponse(ApiResponse.OK);

		return result;
	}

	@GetMapping(value = "/tokens", produces = APPLICATION_JSON_VALUE)
	public ResultList<PersistentAccessToken> getAccessTokens() {
		var result = new ResultList<PersistentAccessToken>();
		result.setEntities(RESULT_KEY_TOKENS, accessTokenService.getAccessTokens());
		result.setResponse(ApiResponse.OK);
		return result;
	}

	@PostMapping(value = "/tokens", consumes = APPLICATION_JSON_VALUE, produces = APPLICATION_JSON_VALUE)
	@ResponseStatus(HttpStatus.CREATED)
	public ResultOne<PersistentAccessToken> createAccessToken(@Valid @RequestBody CreateAccessTokenRequest request) throws ServiceLayerException {
		var result = new ResultOne<PersistentAccessToken>();
		result.setEntity(RESULT_KEY_TOKEN, accessTokenService.createAccessToken(request.getLabel(), request.getExpiresAt()));
		result.setResponse(ApiResponse.OK);
		return result;
	}

	@PostMapping(value = "/tokens/{tokenId}", consumes = APPLICATION_JSON_VALUE, produces = APPLICATION_JSON_VALUE)
	public ResultOne<PersistentAccessToken> updateAccessToken(@PathVariable long tokenId, @RequestBody UpdateAccessTokenRequest request) {
		var result = new ResultOne<PersistentAccessToken>();
		result.setEntity(RESULT_KEY_TOKEN, accessTokenService.updateAccessToken(tokenId, request.isEnabled()));
		result.setResponse(ApiResponse.OK);
		return result;
	}

	@DeleteMapping(value = "/tokens/{tokenId}", produces = APPLICATION_JSON_VALUE)
	public Result deleteAccessToken(@PathVariable long tokenId) {
		accessTokenService.deleteAccessToken(tokenId);
		var result = new Result();
		result.setResponse(ApiResponse.OK);
		return result;
	}

	@PostMapping(value = "/preview/switch", produces = APPLICATION_JSON_VALUE)
	public Result switchPreviewSite(Authentication authentication, HttpServletRequest request, HttpServletResponse response)
		throws ServiceLayerException {
		accessTokenService.refreshPreviewCookie(authentication, request, response, false);
		var result = new Result();
		result.setResponse(ApiResponse.OK);
		return result;
	}

}
