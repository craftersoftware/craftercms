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
package org.craftercms.commons.rest;

import java.beans.ConstructorProperties;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.craftercms.commons.i10n.I10nLogger;
import org.craftercms.commons.i10n.I10nUtils;
import org.springframework.http.MediaType;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.http.server.ServletServerHttpResponse;
import org.springframework.util.MimeTypeUtils;
import org.springframework.web.HttpMediaTypeNotAcceptableException;
import org.springframework.web.accept.ContentNegotiationManager;
import org.springframework.web.context.request.ServletWebRequest;

/**
 * Writes the response using a {@link org.springframework.http.converter.HttpMessageConverter} chosen depending on
 * the acceptable media types from the request (most of the code is just a copy from Spring's {@code
 * AbstractMessageConverterMethodProcessor}).
 *
 * @author avasquez
 */
public class HttpMessageConvertingResponseWriter {

    private static final I10nLogger logger = new I10nLogger(HttpMessageConvertingResponseWriter.class,
                                                            I10nUtils.DEFAULT_LOGGING_MESSAGE_BUNDLE_NAME);

    public static final MediaType MEDIA_TYPE_APPLICATION = new MediaType("application");

    public static final String LOG_KEY_WRITTEN_WITH_MESSAGE_CONVERTER = "logging.rest.writtenWithMessageConverter";

    protected ContentNegotiationManager contentNegotiationManager;
    protected List<HttpMessageConverter<?>> messageConverters;
    protected List<MediaType> allSupportedMediaTypes;

    @ConstructorProperties({"contentNegotiationManager", "messageConverters"})
    public HttpMessageConvertingResponseWriter(ContentNegotiationManager contentNegotiationManager,
                                               List<HttpMessageConverter<?>> messageConverters) {
        this.contentNegotiationManager = contentNegotiationManager;
        this.messageConverters = messageConverters;
        this.allSupportedMediaTypes = getAllSupportedMediaTypes(messageConverters);
    }

    @SuppressWarnings("unchecked")
    public <T> void writeWithMessageConverters(T returnValue, HttpServletRequest request, HttpServletResponse response)
            throws IOException, HttpMediaTypeNotAcceptableException {
        Class<?> returnValueClass = returnValue.getClass();
        List<MediaType> requestedMediaTypes = getAcceptableMediaTypes(request);
        List<MediaType> producibleMediaTypes = getProducibleMediaTypes(returnValueClass);

        Set<MediaType> compatibleMediaTypes = new LinkedHashSet<MediaType>();
        for (MediaType r : requestedMediaTypes) {
            for (MediaType p : producibleMediaTypes) {
                if (r.isCompatibleWith(p)) {
                    compatibleMediaTypes.add(getMostSpecificMediaType(r, p));
                }
            }
        }
        if (compatibleMediaTypes.isEmpty()) {
            throw new HttpMediaTypeNotAcceptableException(producibleMediaTypes);
        }

        List<MediaType> mediaTypes = new ArrayList<>(compatibleMediaTypes);
        MimeTypeUtils.sortBySpecificity(mediaTypes);

        MediaType selectedMediaType = null;
        for (MediaType mediaType : mediaTypes) {
            if (mediaType.isConcrete()) {
                selectedMediaType = mediaType;
                break;
            } else if (mediaType.equals(MediaType.ALL) || mediaType.equals(MEDIA_TYPE_APPLICATION)) {
                selectedMediaType = MediaType.APPLICATION_OCTET_STREAM;
                break;
            }
        }

        if (selectedMediaType != null) {
            selectedMediaType = selectedMediaType.removeQualityValue();
            for (HttpMessageConverter<?> messageConverter : messageConverters) {
                if (messageConverter.canWrite(returnValueClass, selectedMediaType)) {
                    ((HttpMessageConverter<T>) messageConverter).write(returnValue, selectedMediaType,
                            new ServletServerHttpResponse(response));

                    logger.debug(LOG_KEY_WRITTEN_WITH_MESSAGE_CONVERTER, returnValue, selectedMediaType,
                            messageConverter);

                    return;
                }
            }
        }

        throw new HttpMediaTypeNotAcceptableException(allSupportedMediaTypes);
    }

    /**
     * Returns the media types that can be produced:
     * <ul>
     * 	<li>Media types of configured converters that can write the specific return value, or</li>
     * 	<li>{@link org.springframework.http.MediaType#ALL}</li>
     * </ul>
     */
    protected List<MediaType> getProducibleMediaTypes(Class<?> returnValueClass) {
        if (!allSupportedMediaTypes.isEmpty()) {
            List<MediaType> result = new ArrayList<>();
            for (HttpMessageConverter<?> converter : messageConverters) {
                if (converter.canWrite(returnValueClass, null)) {
                    result.addAll(converter.getSupportedMediaTypes());
                }
            }

            return result;
        }
        else {
            return Collections.singletonList(MediaType.ALL);
        }
    }

    /**
     * Return the acceptable media types from the request.
     */
    protected List<MediaType> getAcceptableMediaTypes(HttpServletRequest request)
            throws HttpMediaTypeNotAcceptableException {
        List<MediaType> mediaTypes = contentNegotiationManager.resolveMediaTypes(new ServletWebRequest(request));
        return mediaTypes.isEmpty() ? Collections.singletonList(MediaType.ALL) : mediaTypes;
    }

    /**
     * Return the more specific of the acceptable and the producible media types with the q-value of the former.
     */
    protected MediaType getMostSpecificMediaType(MediaType acceptType, MediaType produceType) {
        produceType = produceType.copyQualityValue(acceptType);

		return acceptType.isMoreSpecific(produceType) ? acceptType : produceType;
    }

    /**
     * Return the media types supported by all provided message converters sorted by specificity via
     * {@link MediaTypeUtils#sortBySpecificity(List)}.
     */
    protected List<MediaType> getAllSupportedMediaTypes(List<HttpMessageConverter<?>> messageConverters) {
        Set<MediaType> allSupportedMediaTypes = new LinkedHashSet<MediaType>();
        for (HttpMessageConverter<?> messageConverter : messageConverters) {
            allSupportedMediaTypes.addAll(messageConverter.getSupportedMediaTypes());
        }

        List<MediaType> result = new ArrayList<MediaType>(allSupportedMediaTypes);

        MimeTypeUtils.sortBySpecificity(result);

        return Collections.unmodifiableList(result);
    }


}
