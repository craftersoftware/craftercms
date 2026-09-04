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
package org.craftercms.commons.http;

import jakarta.servlet.FilterChain;
import jakarta.servlet.RequestDispatcher;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.util.AntPathMatcher;
import org.springframework.web.filter.OncePerRequestFilter;

import java.beans.ConstructorProperties;
import java.io.IOException;
import java.util.stream.Stream;

import static java.util.Objects.requireNonNull;
import static org.apache.commons.lang3.Strings.CS;

/**
 * Filter that strips specific suffixes from the request path info and forwards the request to the new path.
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
					String newPath = CS.removeEnd(path, suffix);
					RequestDispatcher dispatcher = request.getRequestDispatcher(newPath);
					dispatcher.forward(request, response);
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
}
