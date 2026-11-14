package org.kohsuke.groovy.sandbox.impl;

import org.codehaus.groovy.syntax.Types;

import java.util.HashMap;
import java.util.Map;

import static org.codehaus.groovy.syntax.Types.*;

/**
 * Additional relationship between operators.
 *
 * @author Kohsuke Kawaguchi
 * @see Types
 */
public class Ops {
	private static final Map<Integer, Integer> compoundAssignmentToBinaryOperator = new HashMap<Integer, Integer>();

	public static int compoundAssignmentToBinaryOperator(int type) {
		Integer o = compoundAssignmentToBinaryOperator.get(type);
		if (o == null) throw new IllegalArgumentException("" + type);
		return o;
	}

	private static final Map<Integer, String> binaryOperatorMethods = new HashMap<Integer, String>();

	public static String binaryOperatorMethods(int type) {
		String v = binaryOperatorMethods.get(type);
		if (v == null) throw new IllegalArgumentException("" + type);
		return v;
	}

	public static boolean isComparisionOperator(int type) {
		return Types.ofType(type, COMPARISON_OPERATOR);
	}

	public static boolean isRegexpComparisonOperator(int type) {
		return Types.ofType(type, REGEX_COMPARISON_OPERATOR);
	}

	public static boolean isLogicalOperator(int type) {
		return Types.ofType(type, LOGICAL_OPERATOR);
	}


	// see http://groovy.codehaus.org/Operator+Overloading
	static {
		Map<Integer, Integer> c = compoundAssignmentToBinaryOperator;
		c.put(PLUS_EQUAL, PLUS);
		c.put(MINUS_EQUAL, MINUS);
		c.put(MULTIPLY_EQUAL, MULTIPLY);
		c.put(DIVIDE_EQUAL, DIVIDE);
		c.put(INTDIV_EQUAL, INTDIV);
		c.put(MOD_EQUAL, MOD);
		// since Groovy 5, % and %= are parsed as REMAINDER and REMAINDER_EQUAL instead of MOD and MOD_EQUAL
		c.put(REMAINDER_EQUAL, REMAINDER);
		c.put(POWER_EQUAL, POWER);

		c.put(LEFT_SHIFT_EQUAL, LEFT_SHIFT);
		c.put(RIGHT_SHIFT_EQUAL, RIGHT_SHIFT);
		c.put(RIGHT_SHIFT_UNSIGNED_EQUAL, RIGHT_SHIFT_UNSIGNED);

		c.put(BITWISE_OR_EQUAL, BITWISE_OR);
		c.put(BITWISE_AND_EQUAL, BITWISE_AND);
		c.put(BITWISE_XOR_EQUAL, BITWISE_XOR);

		// see BinaryExpressionHelper.eval
		Map<Integer, String> b = binaryOperatorMethods;
		b.put(PLUS, "plus");
		b.put(MINUS, "minus");
		b.put(MULTIPLY, "multiply");
		b.put(POWER, "power");
		b.put(DIVIDE, "div");
		b.put(MOD, "mod");
		// Groovy 5+ dispatches % to remainder(), which differs from mod() for negative operands
		b.put(REMAINDER, "remainder");
		b.put(BITWISE_OR, "or");
		b.put(BITWISE_AND, "and");
		b.put(BITWISE_XOR, "xor");
		b.put(LEFT_SHIFT, "leftShift");
		b.put(RIGHT_SHIFT, "rightShift");
		b.put(RIGHT_SHIFT_UNSIGNED, "rightShiftUnsigned");

		b.put(COMPARE_EQUAL, "compareEqual");
		b.put(COMPARE_NOT_EQUAL, "compareNotEqual");
		b.put(COMPARE_LESS_THAN, "compareLessThan");
		b.put(COMPARE_LESS_THAN_EQUAL, "compareLessThanEqual");
		b.put(COMPARE_GREATER_THAN, "compareGreaterThan");
		b.put(COMPARE_GREATER_THAN_EQUAL, "compareGreaterThanEqual");
		b.put(COMPARE_TO, "compareTo");

		b.put(FIND_REGEX, "findRegex");
		b.put(MATCH_REGEX, "matchRegex");
	}
}
