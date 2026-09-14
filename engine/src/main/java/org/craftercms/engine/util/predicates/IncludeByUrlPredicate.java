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
package org.craftercms.engine.util.predicates;

import java.util.Arrays;
import java.util.List;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import org.apache.commons.collections4.Predicate;
import org.apache.commons.logging.Log;
import org.apache.commons.logging.LogFactory;
import org.craftercms.core.service.Item;

/**
 * Predicate used to check if an item is included by its url.
 *
 **/
public class IncludeByUrlPredicate implements Predicate<Item> {

	private static final Log logger = LogFactory.getLog(IncludeByUrlPredicate.class);

	protected List<Pattern> includePatterns;

	public IncludeByUrlPredicate(String[] includeRegexes) {
		this.includePatterns = Arrays.stream(includeRegexes).map(Pattern::compile).collect(Collectors.toList());
	}

	@Override
	public boolean evaluate(Item item) {
		return includePatterns.stream().anyMatch(p -> p.matcher(item.getUrl()).matches());
	}

}
