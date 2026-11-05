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

package org.craftercms.studio.api.v2.dal;

import org.apache.ibatis.annotations.Param;
import org.craftercms.studio.model.security.PersistentAccessToken;

import java.util.Collection;
import java.util.List;

public interface SecurityDAO {

	// Access Tokens

	void upsertRefreshToken(@Param("userId") long userId, @Param("token") String token);

	boolean validateRefreshToken(@Param("userId") long userId, @Param("token") String token);

	/**
	 * Gets the seconds left until the refresh token of the user is older than the given minutes
	 *
	 * @return the seconds (negative if already older), or null if the user has no refresh token
	 */
	Long getRefreshTokenRemainingSeconds(@Param("userId") long userId, @Param("minutes") int minutes);

	/**
	 * Restarts the session time limit of the user if the extensions used are below the given maximum
	 *
	 * @return the number of refresh tokens updated, 0 if the maximum was reached
	 */
	int extendSession(@Param("userId") long userId, @Param("maxExtensions") int maxExtensions);

	Integer getSessionExtensions(@Param("userId") long userId);

	void resetSessionExtensions(@Param("userId") long userId);

	void deleteRefreshToken(@Param("userId") long userId);

	void deleteRefreshTokens(@Param("userIds") Collection<Long> userIds);

	PersistentAccessToken getAccessTokenById(@Param("tokenId") long tokenId);

	PersistentAccessToken getAccessTokenByUserIdAndTokenId(@Param("userId") long userId,
							       @Param("tokenId") long tokenId);

	void createAccessToken(@Param("userId") long userId, @Param("token") PersistentAccessToken token);

	List<PersistentAccessToken> getAccessTokens(@Param("userId") long userId);

	void updateAccessToken(@Param("userId") long userId, @Param("tokenId") long tokenId,
			       @Param("enabled") boolean enabled);

	void deleteAccessToken(@Param("userId") long userId, @Param("tokenId") long tokenId);

	void deleteUsersAccessTokens(@Param("userIds") Collection<Long> userIds);

	int deleteExpiredTokens(@Param("sessionTimeout") int sessionTimeout,
				@Param("inactiveUsers") List<Long> inactiveUsers);

}
