/*
 * Copyright (C) 2007-2022 Crafter Software Corporation. All Rights Reserved.
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
package org.craftercms.studio.impl.v2.service.security.internal;

import com.google.common.cache.Cache;
import com.google.common.cache.CacheBuilder;
import org.craftercms.commons.crypto.CryptoException;
import org.craftercms.commons.crypto.TextEncryptor;
import org.craftercms.commons.http.NamedCookieManager;
import org.craftercms.studio.api.v1.exception.ServiceLayerException;
import org.craftercms.studio.api.v1.exception.SiteNotFoundException;
import org.craftercms.studio.api.v1.service.site.SiteService;
import org.craftercms.studio.api.v2.dal.RetryingDatabaseOperationFacade;
import org.craftercms.studio.api.v2.dal.SecurityDAO;
import org.craftercms.studio.api.v2.dal.User;
import org.craftercms.studio.api.v2.service.audit.internal.AuditServiceInternal;
import org.craftercms.studio.api.v2.service.security.SecurityService;
import org.craftercms.studio.api.v2.service.security.internal.AccessTokenServiceInternal;
import org.craftercms.studio.api.v2.service.system.InstanceService;
import org.craftercms.studio.api.v2.utils.StudioConfiguration;
import org.craftercms.studio.api.v2.utils.spring.context.SystemStatusProvider;
import org.craftercms.studio.model.security.AccessToken;
import org.craftercms.studio.model.security.PersistentAccessToken;
import org.jose4j.jwa.AlgorithmConstraints;
import org.jose4j.jwe.JsonWebEncryption;
import org.jose4j.jws.AlgorithmIdentifiers;
import org.jose4j.jws.JsonWebSignature;
import org.jose4j.jwt.JwtClaims;
import org.jose4j.jwt.MalformedClaimException;
import org.jose4j.jwt.NumericDate;
import org.jose4j.jwt.consumer.InvalidJwtException;
import org.jose4j.jwt.consumer.JwtConsumerBuilder;
import org.jose4j.keys.HmacKey;
import org.jose4j.keys.PbkdfKey;
import org.jose4j.lang.JoseException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.beans.ConstructorProperties;
import java.security.Key;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

import static java.lang.Long.parseLong;
import static java.lang.String.format;
import static java.nio.charset.StandardCharsets.UTF_8;
import static java.time.Instant.now;
import static java.time.temporal.ChronoUnit.MINUTES;
import static java.util.stream.Collectors.toList;
import static org.apache.commons.lang3.StringUtils.isEmpty;
import static org.apache.commons.lang3.StringUtils.isNotEmpty;
import static org.craftercms.commons.http.HttpUtils.getCookieValue;
import static org.craftercms.studio.api.v2.dal.AuditLogConstants.*;
import static org.craftercms.studio.api.v2.utils.StudioConfiguration.CONFIGURATION_GLOBAL_SYSTEM_SITE;
import static org.jose4j.jwa.AlgorithmConstraints.ConstraintType.PERMIT;
import static org.jose4j.jwe.ContentEncryptionAlgorithmIdentifiers.AES_256_CBC_HMAC_SHA_512;
import static org.jose4j.jwe.KeyManagementAlgorithmIdentifiers.PBES2_HS512_A256KW;
import static org.springframework.web.util.WebUtils.getCookie;

/**
 * Default implementation of {@link AccessTokenServiceInternal}
 *
 * @author joseross
 * @since 4.0
 */
public class AccessTokenServiceInternalImpl implements AccessTokenServiceInternal, InitializingBean {

    private static final Logger logger = LoggerFactory.getLogger(AccessTokenServiceInternalImpl.class);

    public static final String ACTIVITY_CACHE_CONFIG_KEY = "studio.security.activity.cache.config";
    private static final String CRAFTER_SITE_COOKIE_NAME = "crafterSite";
    private static final String JWE_ALGORITHM_HEADER_VALUE = PBES2_HS512_A256KW;
    private static final String JWE_ENCRYPTION_METHOD_HEADER_VALUE = AES_256_CBC_HMAC_SHA_512;

    /**
     * The issuer for generation access tokens
     */
    protected final String issuer;

    /**
     * List of accepted issuers for validation of access tokens
     */
    protected final String[] validIssuers;

    /**
     * The audience for generation and validation of access tokens
     */
    protected String audience;

    /**
     * The time in minutes for the expiration of the generated access tokens
     */
    protected final int accessTokenExpiration;

    /**
     * The password for signing the access tokens
     */
    protected final String signPassword;

    /**
     * The password for encrypting the access tokens
     */
    protected final String encryptPassword;

    /**
     * Time in minutes after which active users will be required to login again
     */
    protected final int sessionTimeout;

    /**
     * Time in minutes after which inactive users will be required to login again
     */
    protected final int inactivityTimeout;

	private NamedCookieManager refreshTokenCookieManager;
	private NamedCookieManager previewCookieManager;

    /**
     * Cache used to track the activity of the users
     */
    protected Cache<Long, Instant> userActivity;

    protected Key jwtSignKey;
    protected Key jwtEncryptKey;

    protected final SecurityDAO securityDao;
    protected final SecurityService securityService;
    protected final InstanceService instanceService;
    protected final AuditServiceInternal auditService;
    protected final StudioConfiguration studioConfiguration;
    protected final SiteService siteService;
    protected final RetryingDatabaseOperationFacade retryingDatabaseOperationFacade;
    protected final SystemStatusProvider systemStatusProvider;
    protected final TextEncryptor previewTokenEncryptor;

    @ConstructorProperties({"issuer", "validIssuers", "accessTokenExpiration", "signPassword", "encryptPassword",
            "sessionTimeout", "inactivityTimeout", "securityDao", "instanceService", "auditService",
            "studioConfiguration", "siteService", "retryingDatabaseOperationFacade", "systemStatusProvider",
            "previewTokenEncryptor", "securityService"})
    public AccessTokenServiceInternalImpl(String issuer, String[] validIssuers, int accessTokenExpiration,
                                          String signPassword, String encryptPassword, int sessionTimeout,
                                          int inactivityTimeout, SecurityDAO securityDao,
                                          InstanceService instanceService, AuditServiceInternal auditService,
                                          StudioConfiguration studioConfiguration, SiteService siteService,
                                          RetryingDatabaseOperationFacade retryingDatabaseOperationFacade,
                                          SystemStatusProvider systemStatusProvider, TextEncryptor previewTokenEncryptor,
                                          SecurityService securityService) {
        this.issuer = issuer;
        this.validIssuers = validIssuers;
        this.accessTokenExpiration = accessTokenExpiration;
        this.signPassword = signPassword;
        this.encryptPassword = encryptPassword;
        this.sessionTimeout = sessionTimeout;
        this.inactivityTimeout = inactivityTimeout;
        this.securityDao = securityDao;
        this.instanceService = instanceService;
        this.auditService = auditService;
        this.studioConfiguration = studioConfiguration;
        this.siteService = siteService;
        this.retryingDatabaseOperationFacade = retryingDatabaseOperationFacade;
        this.systemStatusProvider = systemStatusProvider;
        this.previewTokenEncryptor = previewTokenEncryptor;
        this.securityService = securityService;
    }

    public void setAudience(String audience) {
        this.audience = audience;
    }

    @Override
    public void afterPropertiesSet() {
        userActivity = CacheBuilder.from(studioConfiguration.getProperty(ACTIVITY_CACHE_CONFIG_KEY)).build();
        jwtSignKey = new HmacKey(signPassword.getBytes(UTF_8));
        jwtEncryptKey = new PbkdfKey(encryptPassword);
    }

    @Override
    public boolean hasValidRefreshToken(Authentication auth, HttpServletRequest request, HttpServletResponse response) {
        var cookie = getCookie(request, refreshTokenCookieManager.getName());
        var refreshToken = cookie != null ? cookie.getValue() : null;
        var userId = getUserId(auth);

        boolean valid = isNotEmpty(refreshToken) && securityDao.validateRefreshToken(userId, refreshToken);

        // clear the cookie & auth when the token is missing or expired
        if (!valid) {
            SecurityContextHolder.clearContext();
            request.getSession().invalidate();
            refreshTokenCookieManager.deleteCookie(response);
        }

        return valid;
    }

    @Override
    public void updateRefreshToken(Authentication auth, HttpServletResponse response) {
        var refreshToken = UUID.randomUUID().toString();
        var userId = getUserId(auth);

        retryingDatabaseOperationFacade.retry(() -> securityDao.upsertRefreshToken(userId, refreshToken));
        refreshTokenCookieManager.addCookie(refreshToken, response);
    }

    @Override
    public void refreshPreviewCookie(final Authentication auth, final HttpServletRequest request, final HttpServletResponse response, boolean silent) throws ServiceLayerException {
        String siteName = getCookieValue(CRAFTER_SITE_COOKIE_NAME, request);
        if (isEmpty(siteName)) {
            logger.debug("No site name found in '{}' cookie, removing preview cookie", CRAFTER_SITE_COOKIE_NAME);
            previewCookieManager.deleteCookie(response);
        } else if (!securityService.isSiteMember(auth.getName(), siteName)) {
            logger.debug("User '{}' is not a member of site '{}', removing preview cookie", auth.getName(), siteName);
            previewCookieManager.deleteCookie(response);
            if (!silent) {
                throw new SiteNotFoundException(siteName);
            }
        } else {
            String previewCookie = createPreviewCookie(siteName);
            previewCookieManager.addCookie(previewCookie, response);
            logger.debug("Refreshed preview cookie for user '{}'", auth.getName());
        }
    }

    /**
     * Creates an encrypted preview cookie for the given site name with the same expiration as the access token
     *
     * @param siteName the site name
     * @return the preview cookie
     * @throws ServiceLayerException if the cookie cannot be encrypted
     */
    private String createPreviewCookie(final String siteName) throws ServiceLayerException {
        long timestamp = System.currentTimeMillis() + TimeUnit.SECONDS.toMillis(previewCookieManager.getMaxAge());

        String token = format("%s|%s", siteName, timestamp);
        try {
            return previewTokenEncryptor.encrypt(token);
        } catch (CryptoException e) {
            throw new ServiceLayerException("Failed to encrypt preview cookie", e);
        }
    }

    @Override
    public void deletePreviewCookie(HttpServletResponse response) {
        previewCookieManager.deleteCookie(response);
    }

    @Override
    public AccessToken createTokens(Authentication auth, HttpServletRequest request, HttpServletResponse response) throws ServiceLayerException {
        logger.debug("Create tokens for '{}'", auth.getName());
        var issuedAt = now();
        var expireAt = issuedAt.plus(accessTokenExpiration, MINUTES);

        String token = createToken(issuedAt, expireAt, auth.getName(), null);

        updateRefreshToken(auth, response);
        refreshPreviewCookie(auth, request, response, true);

        var accessToken = new AccessToken();
        accessToken.setToken(token);
        accessToken.setExpiresAt(expireAt);

        return accessToken;
    }

    @Override
    public void deleteRefreshToken(long userId) {
        userActivity.invalidate(userId);
        retryingDatabaseOperationFacade.retry(() -> securityDao.deleteRefreshToken(userId));
    }

    @Override
    public void deleteExpiredRefreshTokens() {
        if (systemStatusProvider.isSystemReady()) {
            logger.debug("Clean up Refresh Tokens");
            List<Long> inactiveUsers = userActivity.asMap().entrySet().stream()
                                        .filter(entry -> MINUTES.between(entry.getValue(), now()) > inactivityTimeout)
                                        .map(Map.Entry::getKey)
                                        .collect(toList());
            userActivity.invalidateAll(inactiveUsers);
            int deleted = retryingDatabaseOperationFacade.retry(() -> securityDao.deleteExpiredTokens(sessionTimeout, inactiveUsers));
            logger.debug("Deleted '{}' expired Refresh Tokens", deleted);
        } else {
            logger.debug("The system is not ready yet, skip the Refresh Token cleanup");
        }
    }

    @Override
    public PersistentAccessToken createAccessToken(String label, Instant expiresAt) throws ServiceLayerException {
        var auth = SecurityContextHolder.getContext().getAuthentication();

        var token = new PersistentAccessToken();
        token.setLabel(label);
        token.setExpiresAt(expiresAt);

        retryingDatabaseOperationFacade.retry(() -> securityDao.createAccessToken(getUserId(auth), token));

        token.setToken(createToken(now(), expiresAt, auth.getName(), token.getId()));

        createAuditLog(auth, token.getId(), TARGET_TYPE_ACCESS_TOKEN, OPERATION_CREATE);

        return token;
    }

    @Override
    public List<PersistentAccessToken> getAccessTokens() {
        var auth = SecurityContextHolder.getContext().getAuthentication();

        return securityDao.getAccessTokens(getUserId(auth));
    }

    @Override
    public PersistentAccessToken updateAccessToken(long tokenId, boolean enabled) {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        var userId = getUserId(auth);

        retryingDatabaseOperationFacade.retry(() -> securityDao.updateAccessToken(userId, tokenId, enabled));

        createAuditLog(auth, tokenId, TARGET_TYPE_ACCESS_TOKEN, OPERATION_UPDATE);

        return securityDao.getAccessTokenByUserIdAndTokenId(userId, tokenId);
    }

    @Override
    public void deleteAccessToken(long tokenId) {
        var auth = SecurityContextHolder.getContext().getAuthentication();

        retryingDatabaseOperationFacade.retry(() -> securityDao.deleteAccessToken(getUserId(auth), tokenId));

        createAuditLog(auth, tokenId, TARGET_TYPE_ACCESS_TOKEN, OPERATION_DELETE);
    }

    @Override
    public void deleteUsersTokens(List<Long> userIds) {
        userIds.forEach(userId -> userActivity.invalidate(userId));
        retryingDatabaseOperationFacade.retry(() -> securityDao.deleteRefreshTokens(userIds));
        retryingDatabaseOperationFacade.retry(() -> securityDao.deleteUsersAccessTokens(userIds));
    }

    protected String getActualAudience() {
        return isNotEmpty(audience)? audience : instanceService.getInstanceId();
    }

    @Override
    public String getUsername(String token) {
        try {
            AlgorithmConstraints constraints = getAlgorithmConstraints();
            var jwtConsumer = new JwtConsumerBuilder()
                    .setEnableRequireEncryption()
                    .setRequireSubject()
                    .setExpectedIssuers(true, validIssuers)
                    .setExpectedAudience(getActualAudience())
                    .setVerificationKey(jwtSignKey)
                    .setDecryptionKey(jwtEncryptKey)
                    .setJweAlgorithmConstraints(constraints)
                    .build();

            var claims = jwtConsumer.processToClaims(token);

            var username = claims.getSubject();
            var jwtId = claims.getJwtId();
            if (isNotEmpty(jwtId)) {
                var tokenId = parseLong(jwtId);
                var storedToken = securityDao.getAccessTokenById(tokenId);
                if (storedToken == null) {
                    // someone is trying to use a deleted token!
                    logger.info("Detected the usage of a deleted JWT with the ID '{}' for user '{}'",
                            tokenId, username);
                    createAuditLog(username, tokenId, TARGET_TYPE_ACCESS_TOKEN, OPERATION_LOGIN_FAILED);
                    return null;
                }
                if (!storedToken.isEnabled()) {
                    // someone is trying to use a disabled token!
                    logger.info("Detected the usage of a disabled JWT with the ID '{}' for user '{}'",
                            tokenId, username);
                    createAuditLog(username, tokenId, TARGET_TYPE_ACCESS_TOKEN, OPERATION_LOGIN_FAILED);
                    return null;
                }

                logger.debug("Successfully validated JWT with ID '{}' for user '{}'", tokenId, username);
                createAuditLog(username, tokenId, TARGET_TYPE_ACCESS_TOKEN, OPERATION_LOGIN);
            } else {
                logger.debug("Successfully validated JWT with for user '{}'", username);
            }

            // Return the user
            return username;
        } catch (InvalidJwtException | MalformedClaimException e) {
            // someone is trying to use an invalid token!
            logger.warn("Detected the usage of an invalid JWT. Message '{}'", e.getMessage());
            logger.debug("Invalid JWT", e);
            createAuditLog("JWT", -1, TARGET_TYPE_ACCESS_TOKEN, "", OPERATION_LOGIN_FAILED);
        }
        return null;
    }

    protected long getUserId(Authentication auth) {
        return ((User) auth.getPrincipal()).getId();
    }

    protected String createToken(Instant issuedAt, Instant expiresAt, String username, Long id)
            throws ServiceLayerException {
        var claims = new JwtClaims();
        claims.setIssuer(issuer);
        claims.setIssuedAt(NumericDate.fromMilliseconds(issuedAt.toEpochMilli()));
        claims.setSubject(username);
        claims.setAudience(getActualAudience());
        if (expiresAt != null) {
            claims.setExpirationTime(NumericDate.fromMilliseconds(expiresAt.toEpochMilli()));
        }
        if (id != null) {
            claims.setJwtId(id.toString());
        }

        try {
            // Sign the JWT
            var jws = new JsonWebSignature();
            jws.setPayload(claims.toJson());
            jws.setKey(jwtSignKey);
            jws.setAlgorithmHeaderValue(AlgorithmIdentifiers.HMAC_SHA512);

            // Encrypt the JWS
            var jwe = new JsonWebEncryption();
            AlgorithmConstraints constraints = getAlgorithmConstraints();
            jwe.setAlgorithmConstraints(constraints);
            jwe.setContentEncryptionAlgorithmConstraints(constraints);
            jwe.setPayload(jws.getCompactSerialization());
            jwe.setAlgorithmHeaderValue(JWE_ALGORITHM_HEADER_VALUE);
            jwe.setEncryptionMethodHeaderParameter(JWE_ENCRYPTION_METHOD_HEADER_VALUE);
            jwe.setKey(jwtEncryptKey);
            jwe.setContentTypeHeaderValue("JWT");

            return jwe.getCompactSerialization();
        } catch (JoseException e) {
            throw new ServiceLayerException("Error generating JWT for user " + username, e);
        }
    }

    /**
     * Get JWE algorithm constraints to allow
     *
     * @return an {@link AlgorithmConstraints} instance allow the algorithm and encryption method used for the JWE
     */
    private AlgorithmConstraints getAlgorithmConstraints() {
        return new AlgorithmConstraints(PERMIT, JWE_ALGORITHM_HEADER_VALUE, JWE_ENCRYPTION_METHOD_HEADER_VALUE);
    }

    protected void createAuditLog(Authentication auth, long tokenId, String type, String operation) {
        createAuditLog(auth.getName(), tokenId, type, operation);
    }

    protected void createAuditLog(String actor, long tokenId, String type, String operation) {
        createAuditLog(actor, tokenId, type, Long.toString(tokenId), operation);
    }

    protected void createAuditLog(String actor, long tokenId, String type, String value, String operation) {
        try {
            var site = siteService.getSite(studioConfiguration.getProperty(CONFIGURATION_GLOBAL_SYSTEM_SITE));
            var entry = auditService.createAuditLogEntry();
            entry.setOperation(operation);
            entry.setActorId(actor);
            entry.setSiteId(site.getId());
            entry.setPrimaryTargetId(Long.toString(tokenId));
            entry.setPrimaryTargetType(type);
            entry.setPrimaryTargetValue(value);
            auditService.insertAuditLog(entry);
        } catch (SiteNotFoundException e) {
            // should never happen
        }
    }

    @Override
    public void updateUserActivity(Authentication authentication) {
        logger.debug("Update user activity for '{}'", authentication.getName());
        userActivity.put(getUserId(authentication), now());
    }

	public void setRefreshTokenCookieManager(final NamedCookieManager refreshTokenCookieManager) {
		this.refreshTokenCookieManager = refreshTokenCookieManager;
	}

	public void setPreviewCookieManager(final NamedCookieManager previewCookieManager) {
		this.previewCookieManager = previewCookieManager;
	}
}
