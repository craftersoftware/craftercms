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
package org.craftercms.commons.http;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.util.AntPathMatcher;
import org.springframework.web.filter.OncePerRequestFilter;

import java.beans.ConstructorProperties;
import java.io.IOException;
import java.util.stream.Stream;

import static java.util.Objects.requireNonNull;
import static org.apache.commons.lang3.Strings.CS;

/**
 * Filter that strips specific suffixes from the request path, so the rest of the chain sees the request as if it had
 * been made without the suffix.
 */
public class SuffixStrippingFilter extends OncePerRequestFilter {

	private final String[] suffixes;
	private final String[] includedUrls;
	private final AntPathMatcher pathMatcher;

	@ConstructorProperties({"suffixes", "includedUrls"})
	public SuffixStrippingFilter(final String[] suffixes, final String[] includedUrls) {
		this.suffixes = requireNonNull(suffixes, "suffixes must not be null");
		this.includedUrls = requireNonNull(includedUrls, "includedUrls must not be null");
		pathMatcher = new AntPathMatcher();
	}

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain) throws ServletException, IOException {
		String path = request.getPathInfo();

		if (path != null) {
			for (String suffix : suffixes) {
				if (path.endsWith(suffix)) {
					filterChain.doFilter(new SuffixStrippingRequestWrapper(request, suffix), response);
					return;
				}
			}
		}
		filterChain.doFilter(request, response);
	}

	@Override
	protected boolean shouldNotFilter(HttpServletRequest request) throws ServletException {
		String pathInfo = request.getPathInfo();
		return (pathInfo != null && Stream.of(includedUrls).noneMatch(url -> pathMatcher.match(url, pathInfo)))
				|| super.shouldNotFilter(request);
	}

	/**
	 * Wrapper that hides the suffix from every path accessor, instead of dispatching to the stripped path. A
	 * {@link jakarta.servlet.RequestDispatcher#forward} cannot be used here because the containers suspend the
	 * underlying response once the forward returns, which silently discards the body of any filter that buffers the
	 * response (e.g. {@link org.springframework.web.filter.ShallowEtagHeaderFilter}) and flushes it afterwards.
	 */
	private static class SuffixStrippingRequestWrapper extends HttpServletRequestWrapper {

		private final String suffix;

		SuffixStrippingRequestWrapper(final HttpServletRequest request, final String suffix) {
			super(request);
			this.suffix = suffix;
		}

		@Override
		public String getRequestURI() {
			return stripSuffix(super.getRequestURI());
		}

		@Override
		public StringBuffer getRequestURL() {
			StringBuffer requestUrl = super.getRequestURL();
			return requestUrl == null ? null : new StringBuffer(stripSuffix(requestUrl.toString()));
		}

		@Override
		public String getServletPath() {
			return stripSuffix(super.getServletPath());
		}

		@Override
		public String getPathInfo() {
			return stripSuffix(super.getPathInfo());
		}

		@Override
		public String getPathTranslated() {
			return stripSuffix(super.getPathTranslated());
		}

		private String stripSuffix(final String path) {
			return path == null ? null : CS.removeEnd(path, suffix);
		}
	}
}
