/*
 * The MIT License
 *
 * Copyright 2014 CloudBees, Inc.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

package org.jenkinsci.plugins.scriptsecurity.sandbox.groovy;

import com.google.common.collect.ImmutableSet;
import groovy.lang.Closure;
import groovy.lang.GroovyRuntimeException;
import groovy.lang.MetaMethod;
import groovy.lang.MissingMethodException;
import groovy.lang.MissingPropertyException;
import groovy.lang.Script;

import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.*;
import java.util.logging.Level;
import java.util.logging.Logger;
import javax.annotation.CheckForNull;
import javax.annotation.Nonnull;

import org.apache.commons.collections4.CollectionUtils;
import org.apache.commons.lang3.StringUtils;
import org.codehaus.groovy.runtime.*;
import org.codehaus.groovy.runtime.metaclass.ClosureMetaMethod;
import org.codehaus.groovy.runtime.typehandling.NumberMathModificationInfo;
import org.codehaus.groovy.tools.DgmConverter;
import org.jenkinsci.plugins.scriptsecurity.sandbox.Whitelist;
import org.jenkinsci.plugins.scriptsecurity.sandbox.whitelists.EnumeratingWhitelist;
import org.jenkinsci.plugins.scriptsecurity.sandbox.whitelists.StaticWhitelist;
import org.kohsuke.groovy.sandbox.GroovyInterceptor;
import org.apache.groovy.sql.extensions.SqlExtensions;

import static java.util.Arrays.asList;

@SuppressWarnings("rawtypes")
public final class SandboxInterceptor extends GroovyInterceptor {

	private static final Logger LOGGER = Logger.getLogger(SandboxInterceptor.class.getName());

	private final Whitelist whitelist;

	private final Collection<Class<?>> extensions;

	public SandboxInterceptor(Whitelist whitelist) {
		this(whitelist, asList(DGM_CLASSES));
	}

	public SandboxInterceptor(Whitelist whitelist, List<Class<?>> extensions) {
		this.whitelist = whitelist;
		this.extensions = CollectionUtils.union(asList(DGM_CLASSES), extensions);
	}

	/**
	 * should be synchronized with {@link DgmConverter}
	 */
	private static final Class<?>[] DGM_CLASSES = {
		DefaultGroovyStaticMethods.class,
		DefaultGroovyMethods.class,
		StringGroovyMethods.class,
		EncodingGroovyMethods.class,
		ProcessGroovyMethods.class,
		IOGroovyMethods.class,
		ResourceGroovyMethods.class,
		EncodingGroovyMethods.class,
		SqlExtensions.class
	};

	/**
	 * @see NumberMathModificationInfo
	 */
	private static final Set<String> NUMBER_MATH_NAMES = ImmutableSet.of("plus", "minus", "multiply", "div", "compareTo", "or", "and", "xor", "intdiv", "mod", "remainder", "leftShift", "rightShift", "rightShiftUnsigned");

	@Override
	public Object onMethodCall(GroovyInterceptor.Invoker invoker, Object receiver, String method, Object... args) throws Throwable {
		Method m = GroovyCallSiteSelector.method(receiver, method, args);
		if (m == null) {
			if (receiver instanceof Number && NUMBER_MATH_NAMES.contains(method)) {
				// Synthetic methods like Integer.plus(Integer).
				return super.onMethodCall(invoker, receiver, method, args);
			}

			// look for GDK methods
			Object[] selfArgs = new Object[args.length + 1];
			selfArgs[0] = receiver;
			System.arraycopy(args, 0, selfArgs, 1, args.length);
			Method foundDgmMethod = null;

			for (Class<?> dgmClass : extensions) {
				Method dgmMethod = GroovyCallSiteSelector.staticMethod(dgmClass, method, selfArgs);
				if (dgmMethod != null) {
					if (whitelist.permitsStaticMethod(dgmMethod, selfArgs)) {
						return super.onMethodCall(invoker, receiver, method, args);
					} else if (foundDgmMethod == null) {
						foundDgmMethod = dgmMethod;
					}
				}
			}

			// Some methods are found by GroovyCallSiteSelector in both DefaultGroovyMethods and StringGroovyMethods, so
			// we're iterating over the whole list before we decide to fail out on the first failure we found.
			if (foundDgmMethod != null) {
				throw StaticWhitelist.rejectStaticMethod(foundDgmMethod);
			}

			// allow calling Closure elements of Maps as methods
			if (receiver instanceof Map) {
				Object element = onMethodCall(invoker, receiver, "get", method);
				if (element instanceof Closure) {
					return onMethodCall(invoker, element, "call", args);
				}
			}

			// Allow calling closure variables from a script binding as methods
			if (receiver instanceof Script) {
				Script s = (Script) receiver;
				if (s.getBinding().hasVariable(method)) {
					Object var = s.getBinding().getVariable(method);
					if (!InvokerHelper.getMetaClass(var).respondsTo(var, "call", (Object[]) args).isEmpty()) {
						return onMethodCall(invoker, var, "call", args);
					}
				}
			}

			// if no matching method, look for catchAll "invokeMethod"
			try {
				receiver.getClass().getMethod("invokeMethod", String.class, Object.class);
				return onMethodCall(invoker, receiver, "invokeMethod", method, args);
			} catch (NoSuchMethodException e) {
				// fall through
			}

			MetaMethod metaMethod = findMetaMethod(receiver, method, args);
			if (metaMethod instanceof ClosureMetaMethod) {
				return super.onMethodCall(invoker, receiver, method, args);
			}

			// no such method exists
			throw new MissingMethodException(method, receiver.getClass(), args);
		} else if (StaticWhitelist.isPermanentlyBlacklistedMethod(m)) {
			throw StaticWhitelist.rejectMethod(m);
		} else if (whitelist.permitsMethod(m, receiver, args)) {
			return super.onMethodCall(invoker, receiver, method, args);
		} else if (method.equals("invokeMethod") && args.length == 2 && args[0] instanceof String && args[1] instanceof Object[]) {
			throw StaticWhitelist.rejectMethod(m, EnumeratingWhitelist.getName(receiver.getClass()) + " " + args[0] + printArgumentTypes((Object[]) args[1]));
		} else {
			throw StaticWhitelist.rejectMethod(m);
		}
	}

	@Override
	public Object onNewInstance(GroovyInterceptor.Invoker invoker, Class receiver, Object... args) throws Throwable {
		Constructor<?> c = GroovyCallSiteSelector.constructor(receiver, args);
		if (c == null) {
			throw new UnsupportedOperationException("No such constructor found: new " + EnumeratingWhitelist.getName(receiver) + printArgumentTypes(args));
		} else if (StaticWhitelist.isPermanentlyBlacklistedConstructor(c)) {
			throw StaticWhitelist.rejectNew(c);
		} else if (whitelist.permitsConstructor(c, args)) {
			return super.onNewInstance(invoker, receiver, args);
		} else {
			throw StaticWhitelist.rejectNew(c);
		}
	}

	@Override
	public Object onStaticCall(GroovyInterceptor.Invoker invoker, Class receiver, String method, Object... args) throws Throwable {
		Method m = GroovyCallSiteSelector.staticMethod(receiver, method, args);
		if (m == null) {
			// TODO consider DefaultGroovyStaticMethods
			throw new UnsupportedOperationException("No such static method found: staticMethod " + EnumeratingWhitelist.getName(receiver) + " " + method + printArgumentTypes(args));
		} else if (whitelist.isAllowedGetEnvSystemMethod(m, args)) {
			return super.onStaticCall(invoker, receiver, method, args);
		} else if (StaticWhitelist.isPermanentlyBlacklistedStaticMethod(m)) {
			throw StaticWhitelist.rejectStaticMethod(m);
		} else if (whitelist.permitsStaticMethod(m, args)) {
			return super.onStaticCall(invoker, receiver, method, args);
		} else {
			throw StaticWhitelist.rejectStaticMethod(m);
		}
	}

	@Override
	public Object onSetProperty(GroovyInterceptor.Invoker invoker, final Object receiver, final String property, Object value) throws Throwable {
		if (receiver instanceof Script && !property.equals("binding") && !property.equals("metaClass")) {
			return super.onSetProperty(invoker, receiver, property, value);
		}
		Rejector rejector = null; // avoid creating exception objects unless and until thrown
		// https://github.com/kohsuke/groovy-sandbox/issues/7 need to explicitly check for getters and setters:
		Object[] valueArg = new Object[]{value};
		String setter = "set" + StringUtils.capitalize(property);
		final Method setterMethod = GroovyCallSiteSelector.method(receiver, setter, valueArg);
		if (setterMethod != null) {
			if (whitelist.permitsMethod(setterMethod, receiver, valueArg)) {
				return super.onSetProperty(invoker, receiver, property, value);
			} else if (rejector == null) {
				rejector = new Rejector() {
					@Override
					public UnsupportedOperationException reject() {
						return StaticWhitelist.rejectMethod(setterMethod);
					}
				};
			}
		}
		// Disabled, we have this method in the blacklist so there is no point in supporting it
//        Object[] propertyValueArgs = new Object[] {property, value};
//        final Method setPropertyMethod = GroovyCallSiteSelector.method(receiver, "setProperty", propertyValueArgs);
//        if (setPropertyMethod != null) {
//            if (whitelist.permitsMethod(setPropertyMethod, receiver, propertyValueArgs)) {
//                return super.onSetProperty(invoker, receiver, property, value);
//            } else if (rejector == null) {
//                rejector = new Rejector() {
//                    @Override public RejectedAccessException reject() {
//                        return StaticWhitelist.rejectMethod(setPropertyMethod, receiver.getClass().getName() + "." + property);
//                    }
//                };
//            }
//        }
		final Field instanceField = GroovyCallSiteSelector.field(receiver, property);
		if (instanceField != null) {
			if (whitelist.permitsFieldSet(instanceField, receiver, value)) {
				return super.onSetProperty(invoker, receiver, property, value);
			} else if (rejector == null) {
				rejector = new Rejector() {
					@Override
					public UnsupportedOperationException reject() {
						return StaticWhitelist.rejectField(instanceField);
					}
				};
			}
		}
		if (receiver instanceof Class) {
			final Method staticSetterMethod = GroovyCallSiteSelector.staticMethod((Class) receiver, setter, valueArg);
			if (staticSetterMethod != null) {
				if (whitelist.permitsStaticMethod(staticSetterMethod, valueArg)) {
					return super.onSetProperty(invoker, receiver, property, value);
				} else if (rejector == null) {
					rejector = new Rejector() {
						@Override
						public UnsupportedOperationException reject() {
							return StaticWhitelist.rejectStaticMethod(staticSetterMethod);
						}
					};
				}
			}
			final Field staticField = GroovyCallSiteSelector.staticField((Class) receiver, property);
			if (staticField != null) {
				if (whitelist.permitsStaticFieldSet(staticField, value)) {
					return super.onSetProperty(invoker, receiver, property, value);
				} else if (rejector == null) {
					rejector = new Rejector() {
						@Override
						public UnsupportedOperationException reject() {
							return StaticWhitelist.rejectStaticField(staticField);
						}
					};
				}
			}
		}

		// If the propery was not found use the regular Groovy exception instead the one from sandbox
		if (rejector != null) {
			throw rejector.reject();
		} else {
			throw new MissingPropertyException(property, receiver.getClass());
		}
	}

	@Override
	public Object onGetProperty(GroovyInterceptor.Invoker invoker, final Object receiver, final String property) throws Throwable {
		MissingPropertyException mpe = null;
		if (receiver instanceof Script) { // SimpleTemplateEngine "out" variable, and anything else added in a binding
			try {
				((Script) receiver).getBinding().getVariable(property); // do not let it go to Script.super.getProperty
				return super.onGetProperty(invoker, receiver, property);
			} catch (MissingPropertyException x) {
				mpe = x; // throw only if we are not whitelisted
			}
		}
		if (property.equals("length") && receiver.getClass().isArray()) {
			return super.onGetProperty(invoker, receiver, property);
		}
		Rejector rejector = null;
		Object[] noArgs = new Object[]{};
		String getter = "get" + StringUtils.capitalize(property);
		final Method getterMethod = GroovyCallSiteSelector.method(receiver, getter, noArgs);
		if (getterMethod != null) {
			if (whitelist.permitsMethod(getterMethod, receiver, noArgs)) {
				return super.onGetProperty(invoker, receiver, property);
			} else if (rejector == null) {
				rejector = new Rejector() {
					@Override
					public UnsupportedOperationException reject() {
						return StaticWhitelist.rejectMethod(getterMethod);
					}
				};
			}
		}
		String booleanGetter = "is" + StringUtils.capitalize(property);
		final Method booleanGetterMethod = GroovyCallSiteSelector.method(receiver, booleanGetter, noArgs);
		if (booleanGetterMethod != null && booleanGetterMethod.getReturnType() == boolean.class) {
			if (whitelist.permitsMethod(booleanGetterMethod, receiver, noArgs)) {
				return super.onGetProperty(invoker, receiver, property);
			} else if (rejector == null) {
				rejector = new Rejector() {
					@Override
					public UnsupportedOperationException reject() {
						return StaticWhitelist.rejectMethod(booleanGetterMethod);
					}
				};
			}
		}
		// look for GDK methods
		Object[] selfArgs = new Object[]{receiver};
		for (Class<?> dgmClass : extensions) {
			final Method dgmGetterMethod = GroovyCallSiteSelector.staticMethod(dgmClass, getter, selfArgs);
			if (dgmGetterMethod != null) {
				if (whitelist.permitsStaticMethod(dgmGetterMethod, selfArgs)) {
					return super.onGetProperty(invoker, receiver, property);
				} else if (rejector == null) {
					rejector = new Rejector() {
						@Override
						public UnsupportedOperationException reject() {
							return StaticWhitelist.rejectStaticMethod(dgmGetterMethod);
						}
					};
				}
			}
			final Method dgmBooleanGetterMethod = GroovyCallSiteSelector.staticMethod(dgmClass, booleanGetter, selfArgs);
			if (dgmBooleanGetterMethod != null && dgmBooleanGetterMethod.getReturnType() == boolean.class) {
				if (whitelist.permitsStaticMethod(dgmBooleanGetterMethod, selfArgs)) {
					return super.onGetProperty(invoker, receiver, property);
				} else if (rejector == null) {
					rejector = new Rejector() {
						@Override
						public UnsupportedOperationException reject() {
							return StaticWhitelist.rejectStaticMethod(dgmBooleanGetterMethod);
						}
					};
				}
			}
		}
		final Field instanceField = GroovyCallSiteSelector.field(receiver, property);
		if (instanceField != null) {
			if (whitelist.permitsFieldGet(instanceField, receiver)) {
				return super.onGetProperty(invoker, receiver, property);
			} else if (rejector == null) {
				rejector = new Rejector() {
					@Override
					public UnsupportedOperationException reject() {
						return StaticWhitelist.rejectField(instanceField);
					}
				};
			}
		}
		// Disabled, we have this method in the blacklist so there is no point in supporting it
		// GroovyObject property access
//        Object[] propertyArg = new Object[] {property};
//        final Method getPropertyMethod = GroovyCallSiteSelector.method(receiver, "getProperty", propertyArg);
//        if (getPropertyMethod != null) {
//            if (whitelist.permitsMethod(getPropertyMethod, receiver, propertyArg)) {
//                return super.onGetProperty(invoker, receiver, property);
//            } else if (rejector == null) {
//                rejector = new Rejector() {
//                    @Override public RejectedAccessException reject() {
//                        return StaticWhitelist.rejectMethod(getPropertyMethod, receiver.getClass().getName() + "." + property);
//                    }
//                };
//            }
//        }
		MetaMethod metaMethod = findMetaMethod(receiver, getter, noArgs);
		if (metaMethod instanceof ClosureMetaMethod) {
			return super.onGetProperty(invoker, receiver, property);
		}
		// TODO similar metaclass handling for isXXX, static methods (if possible?), setters
		if (receiver instanceof Class) {
			final Method staticGetterMethod = GroovyCallSiteSelector.staticMethod((Class) receiver, getter, noArgs);
			if (staticGetterMethod != null) {
				if (whitelist.permitsStaticMethod(staticGetterMethod, noArgs)) {
					return super.onGetProperty(invoker, receiver, property);
				} else if (rejector == null) {
					rejector = new Rejector() {
						@Override
						public UnsupportedOperationException reject() {
							return StaticWhitelist.rejectStaticMethod(staticGetterMethod);
						}
					};
				}
			}
			final Method staticBooleanGetterMethod = GroovyCallSiteSelector.staticMethod((Class) receiver, booleanGetter, noArgs);
			if (staticBooleanGetterMethod != null && staticBooleanGetterMethod.getReturnType() == boolean.class) {
				if (whitelist.permitsStaticMethod(staticBooleanGetterMethod, noArgs)) {
					return super.onGetProperty(invoker, receiver, property);
				} else if (rejector == null) {
					rejector = new Rejector() {
						@Override
						public UnsupportedOperationException reject() {
							return StaticWhitelist.rejectStaticMethod(staticBooleanGetterMethod);
						}
					};
				}
			}
			final Field staticField = GroovyCallSiteSelector.staticField((Class) receiver, property);
			if (staticField != null) {
				if (whitelist.permitsStaticFieldGet(staticField)) {
					return super.onGetProperty(invoker, receiver, property);
				} else if (rejector == null) {
					rejector = new Rejector() {
						@Override
						public UnsupportedOperationException reject() {
							return StaticWhitelist.rejectStaticField(staticField);
						}
					};
				}
			}
		}

		// If the property was not found use the regular Groovy exception instead the one from sandbox
		if (rejector != null) {
			throw rejector.reject();
		}
		if (mpe != null) {
			throw mpe;
		} else {
			throw new MissingPropertyException(property, receiver.getClass());
		}
	}

	@Override
	public Object onSuperCall(Invoker invoker, Class senderType, Object receiver, String method, Object... args) throws Throwable {
		Method m = GroovyCallSiteSelector.method(receiver, method, args);
		if (m == null) {
			throw new UnsupportedOperationException("No such method found: super.method " + EnumeratingWhitelist.getName(receiver.getClass()) + " " + method + printArgumentTypes(args));
		} else if (whitelist.permitsMethod(m, receiver, args)) {
			return super.onSuperCall(invoker, senderType, receiver, method, args);
		} else {
			throw StaticWhitelist.rejectMethod(m);
		}
	}

	private static UnsupportedOperationException unclassifiedField(Object receiver, String property) {
		return new UnsupportedOperationException("No such field found: field " + EnumeratingWhitelist.getName(receiver.getClass()) + " " + property);
	}

	// TODO Java 8: @FunctionalInterface
	private interface Rejector {
		@Nonnull
		UnsupportedOperationException reject();
	}

	@Override
	public Object onGetAttribute(Invoker invoker, Object receiver, String attribute) throws Throwable {
		Field field = GroovyCallSiteSelector.field(receiver, attribute);
		if (field == null) {
			throw unclassifiedField(receiver, attribute);
		} else if (whitelist.permitsFieldGet(field, receiver)) {
			return super.onGetAttribute(invoker, receiver, attribute);
		} else {
			throw StaticWhitelist.rejectField(field);
		}
	}

	@Override
	public Object onSetAttribute(Invoker invoker, Object receiver, String attribute, Object value) throws Throwable {
		Field field = GroovyCallSiteSelector.field(receiver, attribute);
		if (field == null) {
			throw unclassifiedField(receiver, attribute);
		} else if (whitelist.permitsFieldSet(field, receiver, value)) {
			return super.onSetAttribute(invoker, receiver, attribute, value);
		} else {
			throw StaticWhitelist.rejectField(field);
		}
	}

	@Override
	public Object onGetArray(Invoker invoker, Object receiver, Object index) throws Throwable {
		if (receiver.getClass().isArray() && index instanceof Integer) {
			return super.onGetArray(invoker, receiver, index);
		}
		Object[] args = new Object[]{index};
		Method method = GroovyCallSiteSelector.method(receiver, "getAt", args);
		if (method != null) {
			if (whitelist.permitsMethod(method, receiver, args)) {
				return super.onGetArray(invoker, receiver, index);
			} else {
				throw StaticWhitelist.rejectMethod(method);
			}
		}
		args = new Object[]{receiver, index};
		for (Class<?> dgm : extensions) {
			method = GroovyCallSiteSelector.staticMethod(dgm, "getAt", args);
			if (method != null) {
				if (whitelist.permitsStaticMethod(method, args)) {
					return super.onGetArray(invoker, receiver, index);
				} else {
					throw StaticWhitelist.rejectStaticMethod(method);
				}
			}
		}
		throw new UnsupportedOperationException("No such getAt method found: method " + EnumeratingWhitelist.getName(receiver) + "[" + EnumeratingWhitelist.getName(index) + "]");
	}

	@Override
	public Object onSetArray(Invoker invoker, Object receiver, Object index, Object value) throws Throwable {
		if (receiver.getClass().isArray() && index instanceof Integer) {
			return super.onSetArray(invoker, receiver, index, value);
		}
		Object[] args = new Object[]{index, value};
		Method method = GroovyCallSiteSelector.method(receiver, "putAt", args);
		if (method != null) {
			if (whitelist.permitsMethod(method, receiver, args)) {
				return super.onSetArray(invoker, receiver, index, value);
			} else {
				throw StaticWhitelist.rejectMethod(method);
			}
		}
		args = new Object[]{receiver, index, value};
		for (Class<?> dgm : extensions) {
			method = GroovyCallSiteSelector.staticMethod(dgm, "putAt", args);
			if (method != null) {
				if (whitelist.permitsStaticMethod(method, args)) {
					return super.onSetArray(invoker, receiver, index, value);
				} else {
					throw StaticWhitelist.rejectStaticMethod(method);
				}
			}
		}
		throw new UnsupportedOperationException("No such putAt method found: putAt method " + EnumeratingWhitelist.getName(receiver) + "[" + EnumeratingWhitelist.getName(index) + "]=" + EnumeratingWhitelist.getName(value));
	}

	private static String printArgumentTypes(Object[] args) {
		StringBuilder b = new StringBuilder();
		for (Object arg : args) {
			b.append(' ');
			b.append(EnumeratingWhitelist.getName(arg));
		}
		return b.toString();
	}

	private static @CheckForNull MetaMethod findMetaMethod(@Nonnull Object receiver, @Nonnull String method, @Nonnull Object[] args) {
		Class<?>[] types = new Class[args.length];
		for (int i = 0; i < types.length; i++) {
			Object arg = args[i];
			types[i] = arg == null ? /* is this right? */void.class : arg.getClass();
		}
		try {
			return DefaultGroovyMethods.getMetaClass(receiver).pickMethod(method, types);
		} catch (GroovyRuntimeException x) { // ambiguous call, supposedly
			LOGGER.log(Level.FINE, "could not find metamethod for " + receiver.getClass() + "." + method + Arrays.toString(types), x);
			return null;
		}
	}

}
