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

package org.craftercms.studio.api.v2.security.publish;

import org.craftercms.commons.security.permissions.annotations.HasPermission;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * This annotation indicates a certain method require the user to
 * be allowed to peer-review a publish package.
 * A user can peer-review a publish package if:
 * <ul>
 *     <li>site config property  {@code workflow.publisher.requirePeerReview} is false</li>
 *     <li>OR the user is NOT the submitter of the package.</li>
 * </ul>
 * This annotation should be used in conjunction with {@link HasPermission} (or similar) to ensure the
 * user has {@code PERMISSION_PUBLISH_REVIEW} permission.
 */
@Target({ElementType.METHOD, ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
public @interface PeerReviewCapable {
}
