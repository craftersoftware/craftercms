package org.craftercms.studio.api.v2.security.publish;

import static org.craftercms.studio.impl.v2.utils.security.SecurityUtils.getAuthentication;

import java.beans.ConstructorProperties;
import java.lang.reflect.Method;
import java.security.InvalidParameterException;

import org.apache.logging.log4j.core.config.Order;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.craftercms.commons.aop.AopUtils;
import org.craftercms.studio.api.v2.annotation.StudioAnnotationUtils;
import org.craftercms.studio.api.v2.annotation.publish.PackageId;
import org.craftercms.studio.api.v2.annotation.resourceids.SiteId;
import org.craftercms.studio.api.v2.dal.User;
import org.craftercms.studio.api.v2.dal.publish.PublishDAO;
import org.craftercms.studio.api.v2.dal.publish.PublishPackage;
import org.craftercms.studio.api.v2.exception.security.ActionsDeniedException;
import org.craftercms.studio.api.v2.exception.security.PackageSubmitterCheckException;

/**
 * Aspect that handles {@link PackageSubmitter} annotations.
 */
@Aspect
@Order(-20)
public class PackageSubmitterAnnotationHandler {

	private final PublishDAO publishDao;

	@ConstructorProperties({ "publishDao" })
	public PackageSubmitterAnnotationHandler(PublishDAO publishDao) {
		this.publishDao = publishDao;
	}

	@Around("@annotation(PackageSubmitter) || within(PackageSubmitter)")
	public Object checkPublishPackageSubmitter(ProceedingJoinPoint pjp) throws Throwable {
		Method method = AopUtils.getActualMethod(pjp);
		String siteId = StudioAnnotationUtils.getAnnotationValue(pjp, method, SiteId.class, String.class);
		if (siteId == null) {
			throw new InvalidParameterException("Site ID is required");
		}
		Long packageId = StudioAnnotationUtils.getAnnotationValue(pjp, method, PackageId.class, Long.class);
		if (packageId == null) {
			throw new InvalidParameterException("Package ID is required");
		}
		PublishPackage publishPackage = publishDao.getByStringSiteId(siteId, packageId);

		User user = (User) getAuthentication().getPrincipal();
		if (publishPackage.getSubmitterId() != user.getId()) {
			throw new PackageSubmitterCheckException(
					"Unable to update publish package '%s' in site '%s' because user is not the submitter"
							.formatted(packageId, siteId));
		}
		return pjp.proceed();
	}
}
