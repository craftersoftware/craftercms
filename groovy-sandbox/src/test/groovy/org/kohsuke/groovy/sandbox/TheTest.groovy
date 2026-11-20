package org.kohsuke.groovy.sandbox

import org.codehaus.groovy.control.customizers.ImportCustomizer
import org.codehaus.groovy.runtime.NullObject
import org.codehaus.groovy.runtime.ProxyGeneratorAdapter
import org.jvnet.hudson.test.Issue
import java.awt.Point
import junit.framework.TestCase
import org.codehaus.groovy.control.CompilerConfiguration

/**
 *
 *
 * @author Kohsuke Kawaguchi
 */
class TheTest extends TestCase {
	def sh, plain;
	def binding = new Binding()
	def ClassRecorder cr = new ClassRecorder()

	void setUp() {
		def cc = new CompilerConfiguration()
		cc.addCompilationCustomizers(new ImportCustomizer().addImports(TheTest.class.name).addStarImports("org.kohsuke.groovy.sandbox"))
		cc.addCompilationCustomizers(new SandboxTransformer())
		sh = new GroovyShell(binding, cc)

		cc = new CompilerConfiguration()
		cc.addCompilationCustomizers(new ImportCustomizer().addImports(TheTest.class.name).addStarImports("org.kohsuke.groovy.sandbox"))
		plain = new GroovyShell(binding, cc)

	}

	private void initVars() {
		binding.foo = "FOO"
		binding.bar = "BAR"
		binding.zot = 5
		binding.point = new Point(1, 2)
		binding.points = [new Point(1, 2), new Point(3, 4)]
		binding.intArray = [0, 1, 2, 3, 4] as int[]
	}

	/**
	 * Evaluates the expression while intercepting calls.
	 */
	def interceptedEval(String expression) {
		cr.reset()
		cr.register();
		try {
			initVars()
			return sh.evaluate(expression);
		} catch (Exception e) {
			throw new Exception("Failed to evaluate " + expression, e)
		} finally {
			cr.unregister();
		}
	}

	/**
	 * In addition to {@link #interceptedEval(String)}, verify that the result is the same as regular non-intercepted Groovy call.
	 */
	def eval(String expression) {
		initVars()
		def expected = plain.evaluate(expression);

		def actual = interceptedEval(expression);
		assert expected == actual;
		return actual;
	}

	def assertIntercept(String expectedCallSequence, Object expectedValue, String script) {
		def actual = eval(script)
		assertEquals(expectedValue, actual);
		assertEquals(expectedCallSequence.replace('/', '\n').trim(), cr.toString().trim())
	}

	def assertIntercept(List<String> expectedCallSequence, Object expectedValue, String script) {
		assertIntercept(expectedCallSequence.join("\n"), expectedValue, script);
	}


	void testOK() {
		// instance call
		assertIntercept(
			"Integer.class/Class:forName(String)",
			String.class,
			"5.class.forName('java.lang.String')")

		assertIntercept(
			"String.toString()/String.hashCode()",
			"foo".hashCode(),
			"'foo'.toString().hashCode()"
		)

		// static call
		assertIntercept(// turns out this doesn't actually result in onStaticCall
			"Math:max(Float,Float)",
			Math.max(1f, 2f),
			"Math.max(1f,2f)"
		)

		assertIntercept(// ... but this does
			"Math:max(Float,Float)",
			Math.max(1f, 2f),
			"import static java.lang.Math.*; max(1f,2f)"
		)

		// property access
		assertIntercept(
			"String.class/Class.name",
			String.class.name,
			"'foo'.class.name"
		)

		// constructor & field access
		assertIntercept(
			"new Point(Integer,Integer)/Point.@x",
			1,
			"new java.awt.Point(1,2).@x"
		)

		// property set
		assertIntercept(
			['Script7.point', "Point.x=Integer"],
			3,
			"point.x=3"
		)
		assertEquals(3, binding.point.@x)

		// attribute set
		assertIntercept(
			['Script8.point', "Point.@x=Integer"],
			4,
			"point.@x=4"
		)
		assertEquals(4, binding.point.@x)

		// property spread
		assertIntercept(
			['Script9.points', "Point.x=Integer/Point.x=Integer"],
			3,
			"points*.x=3"
		)
		assertEquals(3, binding.points[0].@x)
		assertEquals(3, binding.points[1].@x)

		// array set & get
		assertIntercept(
			"int[][Integer]=Integer/int[][Integer]",
			1,
			"def x=new int[3];x[0]=1;x[0]"
		)
	}

	void testClosure() {
		assertIntercept(
			"Script1\$_run_closure1.call()/Integer.class/Class:forName(String)",
			null,
			"def foo = { 5.class.forName('java.lang.String') }\n" +
				"foo()\n" +
				"return null")
	}

	void testClass() {
		assertIntercept(
			"Integer.class/Class:forName(String)",
			null,
			"class foo { static void main(String[] args) { 5.class.forName('java.lang.String') } }")
	}

	void testInnerClass() {
		assertIntercept(
			"foo\$bar:juu()/Integer.class/Class:forName(String)",
			null,
			"class foo {\n" +
				"  class bar {\n" +
				"    static void juu() { 5.class.forName('java.lang.String') }\n" +
				"  }\n" +
				"static void main(String[] args) { bar.juu() }\n" +
				"}")
	}

	void testStaticInitializationBlock() {
		assertIntercept(
			"Integer.class/Class:forName(String)",
			null,
			"class foo {\n" +
				"static { 5.class.forName('java.lang.String') }\n" +
				" static void main(String[] args) { }\n" +
				"}")
	}

	void testConstructor() {
		assertIntercept(
			"new foo()/Integer.class/Class:forName(String)",
			null,
			"class foo {\n" +
				"foo() { 5.class.forName('java.lang.String') }\n" +
				"}\n" +
				"new foo()\n" +
				"return null")
	}

	void testInitializationBlock() {
		assertIntercept(
			"new foo()/Integer.class/Class:forName(String)",
			null,
			"class foo {\n" +
				"{ 5.class.forName('java.lang.String') }\n" +
				"}\n" +
				"new foo()\n" +
				"return null")
	}

	void testFieldInitialization() {
		assertIntercept(
			"new foo()/Integer.class/Class:forName(String)",
			null,
			"class foo {\n" +
				"def obj = 5.class.forName('java.lang.String')\n" +
				"}\n" +
				"new foo()\n" +
				"return null")
	}

	void testStaticFieldInitialization() {
		assertIntercept(
			"new foo()/Integer.class/Class:forName(String)",
			null,
			"class foo {\n" +
				"static obj = 5.class.forName('java.lang.String')\n" +
				"}\n" +
				"new foo()\n" +
				"return null")
	}

	void testCompoundAssignment() {
		assertIntercept(
			"Script1.point/Point.x/Double.plus(Integer)/Point.x=Double",
			(double) 4.0,
			"""
point.x += 3
""")
	}

	void testCompoundAssignment2() {
		// "[I" is the type name of int[]
		assertIntercept(
			"Script1.intArray/int[][Integer]/Integer.leftShift(Integer)/int[][Integer]=Integer",
			1 << 3,
			"""
intArray[1] <<= 3;
""")
	}

	void testRemainder() {
		// Groovy 5+ calls remainder() for %, so -7 % 3 is -1 (mod() would give 2)
		assertIntercept("Integer.remainder(Integer)", -1, "def x = -7; x % 3")
	}

	void testRemainderCompoundAssignment() {
		assertIntercept("Script1.zot/Integer.remainder(Integer)/Script1.zot=Integer", 2, "zot %= 3")
		assertIntercept(
			"Script2.intArray/int[][Integer]/Integer.remainder(Integer)/int[][Integer]=Integer",
			1,
			"intArray[4] %= 3")
	}

	void testComparison() {
		assertIntercept(
			"Script1.point/Script1.point/Point.equals(Point)/Integer.compareTo(Integer)",
			true,
			"""
point==point
5==5
""")
	}

	void testNestedClass() {
		assertIntercept(
			"new Outer()/Outer.sum()/new Outer\$Inner(Outer)/Outer\$Inner.plusOne(Integer)/Integer.plus(Integer)",
			6,
			"""
class Outer {

   class Inner {

       def plusOne(rhs) {
         return rhs+1;
       }
       
   }
   
   def sum() {
       def x = new Inner()
       return x.plusOne(5)
   }
   
}

new Outer().sum()
""")
	}

	// Disabled since anonymous inner classes seem to have issues with reflection in Java 11
	void anonymousNestedClass() {
		assertIntercept(
			"new Script1\$1(Script1)/Script1\$1.plusOne(Integer)/Integer.plus(Integer)",
			6,
			"""
def x = new Object() {
   def plusOne(rhs) {
     return rhs+1;
   }
}
x.plusOne(5)
""")
	}

	void testIssue2() {
		assertIntercept("new HashMap()/HashMap.get(String)/Script1.println(null)", null, "println(new HashMap().dummy);")
		assertIntercept("Script2.println()", null, "println();")
		assertIntercept("Script3.println(null)", null, "println(null);")
	}

	void testSystemExitAsFunction() {
		assertIntercept("TheTest:idem(Integer)/TheTest:idem(Integer)", 123, "org.kohsuke.groovy.sandbox.TheTest.idem(org.kohsuke.groovy.sandbox.TheTest.idem(123))")
	}

	/**
	 * Idempotent function used for testing
	 */
	public static Object idem(Object o) {
		return o;
	}

	void testArrayArgumentsInvocation() {
		assertIntercept('new TheTest$MethodWithArrayArg()/TheTest$MethodWithArrayArg.f(Object[])', 3, "new TheTest.MethodWithArrayArg().f(new Object[3])")
	}

	public static class MethodWithArrayArg {
		public Object f(Object[] arg) {
			return arg.length;
		}
	}

	/**
	 * See issue #6. We are not intercepting calls to null.
	 */
	void testNull() {
		assertIntercept("", NullObject.class, "def x=null; null.getClass()")
		assertIntercept("", "null3", "def x=null; x.plus('3')")
		assertIntercept("", false, "def x=null; x==3")
	}

	/**
	 * See issue #9
	 */
	void testAnd() {
		assertIntercept('', false, """
            String s = null
            if (s != null && s.length > 0)
              throw new Exception();
            return false;
            """)
	}

	void testLogicalNotEquals() {
		assertIntercept("Integer.toString()/String.compareTo(String)", true,
			"def x = 3.toString(); if (x != '') return true; else return false;")
	}

	// see issue 8
	void testClosureDelegation() {
		assertIntercept(
			[
				'Script1$_run_closure1.call()',
				'Script1$_run_closure1.delegate=String',
				'String.length()'
			], 3, """
            def x = 0;
            def c = { ->
                delegate = "foo";
                x = length();
            }
            c();

            x;
        """)
	}

	void testClosureDelegationOwner() {
		assertIntercept(
			[
				"Script1\$_run_closure1.call()",
				'Script1$_run_closure1.delegate=String',
				'Script1$_run_closure1$_closure2.call()',
				'String.length()'
			],
			3, """
            def x = 0;
            def c = { ->
                delegate = "foo";
                { -> x = length(); }();
            }
            c();

            x;
        """)
	}

	void testClosureDelegationProperty() {
		// TODO: ideally we should be seeing String.length()
		// doing so requires a call site selection and deconstruction
		assertIntercept(
			[
				'Script1$_run_closure1.call()',
				'new SomeBean(Integer,Integer)',
				'Script1$_run_closure1.delegate=SomeBean',
				// by the default delegation rule of Closure, it first attempts to get Script1.x,
				// and only after we find out that there's no such property, we fall back to SomeBean.x
				'Script1.x',
				'SomeBean.x',
				'Script1.y',
				'SomeBean.y',
				'Integer.plus(Integer)'
			],
			3, """
            def sum = 0;
            def c = { ->
                delegate = new SomeBean(1,2);
                sum = x+y;
            }
            c();

            sum;
        """)
	}

	void testClosureDelegationPropertyDelegateOnly() {
		assertIntercept(
			[
				'Script1$_run_closure1.call()',
				'new SomeBean(Integer,Integer)',
				'Script1$_run_closure1.delegate=SomeBean',
				'Script1$_run_closure1.resolveStrategy=Integer',
				// with DELEGATE_FIRST rule, unlike testClosureDelegationProperty() it shall not touch Script1.*
				'SomeBean.x',
				'SomeBean.y',
				'Integer.plus(Integer)'
			],
			3, """
            def sum = 0;
            def c = { ->
                delegate = new SomeBean(1,2);
                resolveStrategy = 1; // Closure.DELEGATE_FIRST
                sum = x+y;
            }
            c();

            sum;
        """)
	}

	void testClosureDelegationPropertyOwner() {
		/*
		    The way property access of 'x' gets dispatched to is:

		    innerClosure.getProperty("x"), which delegates to its owner, which is
		    outerClosure.getProperty("x"), which delegates to its delegate, which is
		    SomeBean.x
		 */
		assertIntercept(
			[
				'Script1$_run_closure1.call()',
				'new SomeBean(Integer,Integer)',
				'Script1$_run_closure1.delegate=SomeBean',
				'Script1$_run_closure1$_closure2.call()',
				'Script1.x',
				'SomeBean.x',
				'Script1.y',
				'SomeBean.y',
				'Integer.plus(Integer)'
			],
			3, """
            def sum = 0;
            def c = { ->
                delegate = new SomeBean(1,2);
                { -> sum = x+y; }();
            }
            c();

            sum;
        """)
	}

	void testGString() {
		assertIntercept("Integer.plus(Integer)/Integer.plus(Integer)", "answer=6", '''
            def x = "answer=${1+2+3}";
            x;
        ''')
	}

	void testClosurePropertyAccess() {
		assertIntercept("""
Script1\$_run_closure1.call()
new Exception(String)
Script1\$_run_closure1.delegate=Exception
Script1.message
Exception.message
""", "foo", """
        { ->
            delegate = new Exception("foo");
            return message;
        }();
""")
	}

	/**
	 * Calling method on Closure that's not delegated to somebody else.
	 */
	void testNonDelegatingClosure() {
		assertIntercept([
			'Script1$_run_closure1.hashCode()',
			'Script1$_run_closure1.equals(Script1$_run_closure1)'
		], true, """
            def c = { -> }
            c.hashCode()
            c.equals(c);
        """)

		// but these guys are not on closure
		assertIntercept([
			'Script2$_run_closure1.call()',
			'Script2$_run_closure1.hashCode()',
			'Script2$_run_closure1.hashCode()',
			'Integer.compareTo(Integer)'
		], true, """
            def c = { ->
                hashCode()
            }
            return c()==c.hashCode();
        """)
	}

	// Groovy doesn't allow this?
//    void testLocalClass() {
//        assertIntercept(
//                "new Foo()/Foo.plusOne(Integer)/Integer.plus(Integer)",
//                7,
//"""
//class Foo {
//   def plusTwo(rhs) {
//     class Bar { def plusOne(rhs) { rhs + 2; } }
//     return new Bar().plusOne(rhs)+1;
//   }
//}
//new Foo().plusTwo(5)
//""")
//    }

	// bug 14
	void testUnclassifiedStaticMethod() {
		assertIntercept(
			[
				'Script1.m()',
				'System:getProperty(String)'
			], null, """
            m();
            def m() {
                System.getProperty("foo");
            }
        """)
	}

	void testInstanceOf() {
		assertIntercept(
			[
			], true, """
            def x = 'foo';
            x instanceof String;
        """)
	}

	void testRegexp() {
		assertIntercept(
			[
				'ScriptBytecodeAdapter:findRegex(String,String)',
				'ScriptBytecodeAdapter:matchRegex(String,String)'
			], false, """
            def x = 'foo';
            x =~ /bla/
            x ==~ /bla/
        """)
	}

	@Issue("JENKINS-46088")
	void testMatcherTypeAssignment() {
		assertIntercept(
			[
				'ScriptBytecodeAdapter:findRegex(String,String)',
				'Matcher.matches()'
			], false, """
            def x = 'foo';
            java.util.regex.Matcher m = x =~ /bla/
            return m.matches()
        """)
	}

	void testNumericComparison() {
		assertIntercept(
			[
				'Integer.compareTo(Integer)'
			], true, """
            5 < 8;
        """)
	}

	void testIssue17() {
		assertIntercept(
			[
			], 45, """
            def x = 0;
            for ( i in 0..9 ) {
                x+= i;
            }
            return x;
        """)
	}

	// issue 16
	void testPrePostfixLocalVariable() {
		assertIntercept([
			'Integer.next()',
			'ArrayList[Integer]',
		], [1, 0], """
            def x = 0;
            def y=x++;
            return [x,y];
        """)

		assertIntercept([
			'Integer.previous()'
		], [2, 2], """
            def x = 3;
            def y=--x;
            return [x,y];
        """)
	}

	void testPrePostfixArray() {
		assertIntercept([
			'ArrayList[Integer]',           // for reading x[1] before increment
			'Integer.next()',
			'ArrayList[Integer]=Integer',   // for writing x[1] after increment
			'ArrayList[Integer]',           // for reading x[1] in the return statement
		], [3, 2], """
            def x = [1,2,3];
            def y=x[1]++;
            return [x[1],y];
        """)

		assertIntercept([
			'ArrayList[Integer]',           // for reading x[1] before increment
			'Integer.previous()',
			'ArrayList[Integer]=Integer',   // for writing x[1] after increment
			'ArrayList[Integer]',           // for reading x[1] in the return statement
		], [1, 1], """
            def x = [1,2,3];
            def y=--x[1];
            return [x[1],y];
        """)
	}

	void testPrePostfixProperty() {
		assertIntercept([
			'Script1.x=Integer',    // x=3
			'Script1.x',
			'Integer.next()',
			'Script1.x=Integer',    // read, plus, then write back
			'Script1.x'             // final read for the return statement
		], [4, 3], """
            x = 3;
            def y=x++;
            return [x,y];
        """)

		assertIntercept([
			'Script2.x=Integer',    // x=3
			'Script2.x',
			'Integer.previous()',
			'Script2.x=Integer',    // read, plus, then write back
			'Script2.x'             // final read for the return statement
		], [2, 2], """
            x = 3;
            def y=--x;
            return [x,y];
        """)
	}

	void testCatchStatement() {
		Exception e = interceptedEval("""
            def o = null;
            try {
                o.hello();
                return null;
            } catch (Exception e) {
                return e;
            }
        """);
		assert e instanceof NullPointerException;
	}

	/**
	 * Makes sure the line number in the source code is preserved after translation.
	 */
	void testIssue21() {
		Exception e = interceptedEval("""  // line 1
            def x = null;
            def cl = {
                x.hello();  // line 4
            }
            try {
              cl();     // line 7
            } catch (Exception e) {
              return e;
            }
        """);

		def sw = new StringWriter()
		e.printStackTrace(new PrintWriter(sw));

		def s = sw.toString();
		assert s.contains("Script1.groovy:4");
		assert s.contains("Script1.groovy:7");
	}

	void testIssue15() {
		def e = interceptedEval("""
            try {
              def x = null;
              return x.nullProp;
            } catch (Exception e) {
              return e;
            }
        """);
		assert e instanceof NullPointerException;
		// x.nullProp shouldn't be intercepted, so the record should be empty
		assert cr.toString().trim() == "";

		e = interceptedEval("""
            try {
              def x = null;
              x.nullProp = 1;
            } catch (Exception e) {
              return e;
            }
        """);
		assert e instanceof NullPointerException;
		// x.nullProp shouldn't be intercepted, so the record should be empty
		assert cr.toString().trim() == "";
	}

	void testInOperator() {
		assertIntercept(
			"Integer.isCase(Integer)", true, "1 in 1"
		);

		assertIntercept(
			"Integer.isCase(Integer)", false, "1 in 2"
		);

		assertIntercept(
			"ArrayList.isCase(Integer)", true, "1 in [1]"
		);

		assertIntercept(
			"ArrayList.isCase(Integer)", false, "1 in [2]"
		);
	}

	/**
	 * Property access to Map is handled specially by MetaClassImpl, so our interceptor needs to treat that
	 * accordingly.
	 */
	void testMapPropertyAccess() {
		assertIntercept("new HashMap()/HashMap.get(String)/Script1.println(null)", null, "println(new HashMap().dummy);")
		assertIntercept("new HashMap()/HashMap.put(String,Integer)", 5, "new HashMap().dummy=5")
	}

	/**
	 * Intercepts super.toString()
	 */
	@Issue("JENKINS-42563")
	void testSuperCall() {
		assertIntercept([
			"new Zot()",
			"new Bar()",
			"new Foo()",
			"Zot.toString()",
			"Zot.super(Bar).toString()",
			"String.plus(String)"
		], "xfoo", '''
            class Foo {
                public String toString() {
                    return "foo";
                }
            }
            class Bar extends Foo {
                public String toString() {
                    return "x"+super.toString();
                }
            }
            class Zot extends Bar {}
            new Zot().toString();
        ''')
	}

	void testPostfixOpInClosure() {
		assertIntercept(['ArrayList.each(Script1$_run_closure1)',
				 'Integer.next()',
				 'ArrayList[Integer]',
				 'Integer.next()',
				 'ArrayList[Integer]',
				 'Integer.next()',
				 'ArrayList[Integer]',
				 'Integer.next()',
				 'ArrayList[Integer]',
				 'Integer.next()',
				 'ArrayList[Integer]'],
			5,
			'''def cnt = 0
[0, 1, 2, 3, 4].each {
  cnt++
}
return cnt''')
	}

	@Issue("SECURITY-566")
	void testTypeCoercion() {
		// TODO: Check the following line
//        ProxyGeneratorAdapter.pxyCounter.set(0); // make sure *_groovyProxy names are predictable
		assertIntercept([
			'Locale:getDefault()',
			'Class2_groovyProxy.getDefault()'
		], Locale.getDefault(), '''
            interface I {
                Locale getDefault()
            }
            (Locale as I).getDefault()
        ''')
	}

	@Issue("JENKINS-33468")
	void testClosureImplicitIt() {
		assertIntercept([
			'Script1.c=Script1$_run_closure1',
			'Script1.c(Integer)',
			'Integer.plus(Integer)'
		], 2, '''
                 c = { it + 1 }
                 c(1)
                 '''
		)

		assertIntercept([
			'Script2.c=Script2$_run_closure1',
			'Script2.c(Integer)',
			'Integer.plus(Integer)'
		], 2, '''
                 c = {v -> v + 1 }
                 c(1)
                 '''
		)

		assertIntercept([
			'Script3.c=Script3$_run_closure1',
			'Script3.c()'
		], 2, '''
                 c = {-> 2 }
                 c()
                 '''
		)
	}

	@Issue("JENKINS-46191")
	void testEmptyDeclaration() {
		assertIntercept([""],
			"abc",
			'''
String a
a = "abc"
return a
''')
	}

	@Issue("SECURITY-663")
	void testAsFile() {
		File f = File.createTempFile("foo", ".tmp")

		f.write("This is\na test\n")
		assertIntercept(["new File(String)",
				 'File.each(Script1$_run_closure1)',
				 "ArrayList.leftShift(String)",
				 "ArrayList.leftShift(String)",
				 "ArrayList.join(String)"],
			"This is a test",
			"""
def s = []
(\$/${f.canonicalPath}/\$ as File).each { s << it }
s.join(' ')
""")
	}

	@Issue("JENKINS-50380")
	void testCheckedCastWhenAssignable() {
		assertIntercept(['new NonArrayConstructorList(Boolean,Boolean)',
				 'NonArrayConstructorList.join(String)'],
			"one",
			'''
NonArrayConstructorList foo = new NonArrayConstructorList(true, false)
List castFoo = (List)foo
return castFoo.join('')
''')
	}

	@Issue("JENKINS-50470")
	void testCollectionGetProperty() {
		assertIntercept(['new SimpleNamedBean(String)',
				 'new SimpleNamedBean(String)',
				 'new SimpleNamedBean(String)',
				 // Before the JENKINS-50470 fix, this would just be ArrayList.name
				 'SimpleNamedBean.name',
				 'SimpleNamedBean.name',
				 'SimpleNamedBean.name',
				 'ArrayList.class',
				 'ArrayList.join(String)',
				 'String.plus(String)',
				 'String.plus(Class)'],
			"abc class java.util.ArrayList",
			'''
def l = [new SimpleNamedBean("a"), new SimpleNamedBean("b"), new SimpleNamedBean("c")]
def nameList = l.name
def cl = l.class
return nameList.join('') + ' ' + cl
''')
	}
}
