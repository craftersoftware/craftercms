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
package org.craftercms.studio.api.v2.annotation.policy;

import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.craftercms.studio.api.v2.annotation.resourceids.SiteId;
import org.craftercms.studio.api.v2.exception.validation.ValidationException;
import org.craftercms.studio.api.v2.service.content.ContentService;
import org.craftercms.studio.api.v2.service.policy.PolicyService;
import org.craftercms.studio.model.policy.Action;
import org.craftercms.studio.model.policy.Type;
import org.craftercms.studio.model.policy.ValidationResult;

import java.beans.ConstructorProperties;
import java.lang.annotation.Annotation;
import java.util.HashMap;
import java.util.List;
import java.util.stream.Stream;

import static java.util.function.Predicate.not;
import static org.apache.commons.io.FilenameUtils.getFullPathNoEndSeparator;
import static org.apache.commons.io.FilenameUtils.getName;
import static org.apache.commons.lang3.StringUtils.isNotEmpty;
import static org.craftercms.studio.model.policy.Action.METADATA_CONTENT_TYPE;

/**
 * Interceptor that validates content actions before executing the actual changes.
 *
 * <p>In order to intercept a method it needs to:</p>
 * <ol>
 *     <li>Have a {@link ValidateAction} annotation</li>
 *     <li>Have one {@link String} parameter with a {@link SiteId} annotation</li>
 *     <li>Have one {@link String} parameter with a {@link ActionTargetPath} annotation</li>
 * </ol>
 * All other annotations are optional.
 *
 * @author joseross
 * @since 4.0.0
 */
@Aspect
public class SitePolicyAspect {

	protected PolicyService policyService;
	protected ContentService contentService;

	@ConstructorProperties({"policyService", "contentService"})
	public SitePolicyAspect(PolicyService policyService, ContentService contentService) {
		this.policyService = policyService;
		this.contentService = contentService;
	}

	@Around("@annotation(actionParams)")
	public Object validateAction(ProceedingJoinPoint pjp, ValidateAction actionParams) throws Throwable {
		var annotations = getAnnotations(pjp);

		String siteId = null;
		String targetPath = null;
		int targetPathPosition = -1;
		String targetFilename = null;
		int targetFilenamePosition = -1;
		String sourcePath = null;
		String sourceFilename = null;
		String contentType = null;

		// TODO: Add an annotation to support the file size in the future
		for (var i = 0; i < annotations.length; i++) {
			if (siteId == null && hasAnnotation(annotations[i], SiteId.class)) {
				siteId = (String) pjp.getArgs()[i];
			} else if (targetPath == null && hasAnnotation(annotations[i], ActionTargetPath.class)) {
				targetPathPosition = i;
				targetPath = (String) pjp.getArgs()[i];
			} else if (targetFilename == null && hasAnnotation(annotations[i], ActionTargetFilename.class)) {
				targetFilenamePosition = i;
				targetFilename = (String) pjp.getArgs()[i];
			} else if (sourcePath == null && hasAnnotation(annotations[i], ActionSourcePath.class)) {
				sourcePath = (String) pjp.getArgs()[i];
			} else if (sourceFilename == null && hasAnnotation(annotations[i], ActionSourceFilename.class)) {
				sourceFilename = (String) pjp.getArgs()[i];
			} else if (contentType == null && hasAnnotation(annotations[i], ActionContentType.class)) {
				contentType = (String) pjp.getArgs()[i];
			}
		}

		if (siteId == null || targetPath == null) {
			throw new IllegalArgumentException("Missing required annotations to validate content actions");
		}

		String targetFullPath = getFullPath(targetPath, targetFilename);
		var action = new Action();
		if (actionParams.type() == Type.CREATE && contentService.contentExists(siteId, targetFullPath)) {
			action.setType(Type.EDIT);
		} else {
			action.setType(actionParams.type());
		}
		action.setRecursive(actionParams.recursive());
		action.setTarget(targetFullPath);
		var metadata = new HashMap<String, Object>();
		action.setContentMetadata(metadata);

		if (sourcePath != null) {
			action.setSource(getFullPath(sourcePath, sourceFilename));
		}

		if (contentType != null) {
			metadata.put(METADATA_CONTENT_TYPE, contentType);
		}

		var results = policyService.validate(siteId, List.of(action));

		if (results.stream().anyMatch(not(ValidationResult::isAllowed))) {
			throw new ValidationException("Requested action is not allowed by site policy");
		}

		var modified = results.stream()
			.filter(result -> isNotEmpty(result.getModifiedValue()))
			.findFirst();

		if (modified.isPresent()) {
			var newArgs = pjp.getArgs();
			if (isNotEmpty(targetFilename)) {
				newArgs[targetPathPosition] = getFullPathNoEndSeparator(modified.get().getModifiedValue());
				newArgs[targetFilenamePosition] = getName(modified.get().getModifiedValue());
			} else {
				newArgs[targetPathPosition] = modified.get().getModifiedValue();
			}

			return pjp.proceed(newArgs);
		} else {
			return pjp.proceed();
		}
	}

	protected Annotation[][] getAnnotations(ProceedingJoinPoint pjp) throws NoSuchMethodException {
		var signature = (MethodSignature) pjp.getSignature();
		String methodName = signature.getMethod().getName();
		Class<?>[] parameterTypes = signature.getMethod().getParameterTypes();
		return pjp.getTarget().getClass().getMethod(methodName, parameterTypes).getParameterAnnotations();
	}

	protected boolean hasAnnotation(Annotation[] annotations, Class<? extends Annotation> annotation) {
		return Stream.of(annotations)
			.map(Annotation::annotationType)
			.anyMatch(annotation::equals);
	}

	protected String getFullPath(String path, String filename) {
		return filename != null ? path + "/" + filename : path;
	}

}
