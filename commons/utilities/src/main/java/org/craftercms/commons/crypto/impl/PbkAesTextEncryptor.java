/*
 * Copyright (C) 2007-2026 Crafter Software Corporation. All Rights Reserved.
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
package org.craftercms.commons.crypto.impl;

import java.beans.ConstructorProperties;
import java.security.GeneralSecurityException;
import java.security.Key;
import java.security.spec.KeySpec;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;

import org.apache.commons.codec.binary.Base64;
import org.craftercms.commons.crypto.CryptoUtils;
import org.craftercms.commons.crypto.CryptoException;
import org.craftercms.commons.crypto.TextEncryptor;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.apache.commons.lang3.Strings.CI;
import static org.apache.commons.lang3.StringUtils.isNotBlank;

/**
 * Wrapper for {@link org.craftercms.commons.crypto.impl.AesTextEncryptor} that generates the encryption key based
 * on a password and salt.
 *
 * @author avasquez
 */
public class PbkAesTextEncryptor implements TextEncryptor {

	public static final String DEFAULT_NO_ENCODE_PREFIX = "CCE-V1#";

	private static final String PBK_ALGORITHM = "PBKDF2WithHmacSHA1";
	private static final int PBK_ITER = 65536;
	private static final int PBK_LEN = 128;

	private TextEncryptor actualTextEncryptor;
	private TextEncryptor legacyTextEncryptor;
	private String noEncodePrefix = DEFAULT_NO_ENCODE_PREFIX;

	private static Key generateKey(String password, byte[] salt) throws CryptoException {
		try {
			KeySpec keySpec = new PBEKeySpec(password.toCharArray(), salt, PBK_ITER, PBK_LEN);
			SecretKeyFactory factory = SecretKeyFactory.getInstance(PBK_ALGORITHM);

			return new SecretKeySpec(factory.generateSecret(keySpec).getEncoded(), CryptoUtils.AES_CIPHER_ALGORITHM);
		} catch (GeneralSecurityException e) {
			throw new CryptoException("Unable to generate PBK key", e);
		}
	}

	@ConstructorProperties({"password", "salt"})
	public PbkAesTextEncryptor(String password, String salt) throws CryptoException {
		actualTextEncryptor = new AesTextEncryptor(generateKey(password, salt.getBytes(UTF_8)));
		if (Base64.isBase64(salt)) {
			legacyTextEncryptor = new AesTextEncryptor(generateKey(password, Base64.decodeBase64(salt)));
		}
	}

	/**
	 * Constructs a PbkAesTextEncryptor with the specified password, salt, and noEncodePrefix.
	 *
	 * @param password the password to use for key generation
	 * @param salt the salt to use for key generation
	 * @param noEncodePrefix the prefix added to ciphertext so it can be distinguished from values encrypted with a base64-encoded salt.
	 */
	@ConstructorProperties({"password", "salt", "noEncodePrefix"})
	public PbkAesTextEncryptor(String password, String salt, String noEncodePrefix) throws CryptoException {
		this(password, salt);
		if (isNotBlank(noEncodePrefix)) {
			this.noEncodePrefix = noEncodePrefix;
		}
	}

	@Override
	public String encrypt(String clear) throws CryptoException {
		return noEncodePrefix + actualTextEncryptor.encrypt(clear);
	}

	@Override
	public String decrypt(String encrypted) throws CryptoException {
		if (CI.startsWith(encrypted, noEncodePrefix)) {
			return actualTextEncryptor.decrypt(CI.removeStart(encrypted, noEncodePrefix));
		}
		if (legacyTextEncryptor != null) {
			return legacyTextEncryptor.decrypt(encrypted);
		}

		throw new IllegalStateException("The current configuration doesn't support values encrypted " +
				"with a base64 encoded salt");
	}

}
