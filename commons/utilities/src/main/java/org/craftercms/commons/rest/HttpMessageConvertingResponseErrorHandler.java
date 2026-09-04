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

import java.io.IOException;
import java.net.URI;
import java.util.List;

import org.apache.commons.io.IOUtils;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.client.ClientHttpResponse;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.web.client.HttpMessageConverterExtractor;
import org.springframework.web.client.ResponseErrorHandler;
import org.springframework.web.client.RestClientException;

/**
 * {@link org.springframework.web.client.ResponseErrorHandler} that converts the body of a response with error status
 * code using {@link org.springframework.http.converter.HttpMessageConverter}s, and then throws a
 * {@link RestServiceException} with the deserialized response body as the {@code errorDetails}.
 *
 * @author avasquez
 */
public class HttpMessageConvertingResponseErrorHandler implements ResponseErrorHandler {

    protected List<HttpMessageConverter<?>> messageConverters;
    protected Class<?> responseType;

    public HttpMessageConvertingResponseErrorHandler(Class<?> responseType) {
        this.responseType = responseType;
    }

    public List<HttpMessageConverter<?>> getMessageConverters() {
        return messageConverters;
    }

    public void setMessageConverters(List<HttpMessageConverter<?>> messageConverters) {
        this.messageConverters = messageConverters;
    }

    public Class<?> getResponseType() {
        return responseType;
    }

    public void setResponseType(Class<?> responseType) {
        this.responseType = responseType;
    }

    @Override
    public boolean hasError(ClientHttpResponse response) throws IOException {
        return hasError(response.getStatusCode());
    }

    @Override
    public void handleError(URI url, HttpMethod method, ClientHttpResponse response) throws IOException {
        HttpStatusCode status = response.getStatusCode();
        HttpMessageConverterExtractor<?> responseExtractor = new HttpMessageConverterExtractor<>(responseType,
            messageConverters);

        Object errorDetails;
        try {
            errorDetails = responseExtractor.extractData(response);
        } catch (RestClientException e) {
            // No message converter to extract the response, so make the error details
            // the response body as string
            throw new RestServiceException(status, getResponseBodyAsString(response));
        }

        throw new RestServiceException(status, errorDetails);
    }

    protected boolean hasError(HttpStatusCode statusCode) {
        return (statusCode.is4xxClientError() || statusCode.is5xxServerError());
    }

    protected String getResponseBodyAsString(ClientHttpResponse response) throws IOException {
        return IOUtils.toString(response.getBody(), response.getHeaders().getContentType().getCharset());
    }
}
