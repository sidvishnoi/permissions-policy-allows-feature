import { type Dictionary, Token, parseDictionary } from "structured-headers";

export type FeatureIdentifier = string;
type AllowListValueExceptSourceExpr = "*" | "'self'" | "'src'" | "'none'";
type AllowListValue = URL["origin"] | AllowListValueExceptSourceExpr;

export type AllowList = Set<AllowListValue> | "*" | false;
export type ParsedHeaderValue = Map<FeatureIdentifier, AllowList>;
export type ParsedAllowValue = Map<FeatureIdentifier, AllowList>;

const RE_SEMI_OWS = /;\s*/;
const RE_RWS = /\s+/;

export function parseAllow(
	attrValue: string | ParsedAllowValue,
): ParsedAllowValue {
	if (typeof attrValue !== "string") {
		return attrValue;
	}

	const result: ParsedAllowValue = new Map();

	const directives = attrValue.split(RE_SEMI_OWS).map((s) => s.trim());
	for (const directive of directives.filter(Boolean)) {
		const [feature, ...targetList] = directive
			.split(RE_RWS)
			.map((s) => s.trim())
			.filter(Boolean);

		if (targetList.includes("*")) {
			result.set(feature, "*");
			continue;
		}

		if (targetList.includes("'none'")) {
			result.set(feature, false);
			continue;
		}

		const allowList = new Set<AllowListValue>();
		for (const element of targetList) {
			if (element === "'self'" || element === "'src'") {
				allowList.add(element);
			} else {
				addIfOrigin(allowList, element);
			}
		}
		result.set(feature, allowList);
	}

	return result;
}

export function parseHeader(
	headerValue: string | ParsedHeaderValue,
): ParsedHeaderValue {
	if (typeof headerValue !== "string") {
		return headerValue;
	}

	const result: ParsedHeaderValue = new Map();

	let dict: Dictionary;
	try {
		dict = parseDictionary(headerValue);
	} catch (error) {
		throw new Error("Invalid header value", { cause: error });
	}
	for (const [feature, [value]] of dict) {
		if (value === true) {
			throw new Error("Invalid header value: allowlist part is missing");
		}
		const allowList = getAllowListForParsedDictMember(value);
		result.set(feature, allowList);
	}

	return result;
}

function getAllowListForParsedDictMember(value: unknown): AllowList {
	const allowList = new Set<AllowListValue>();
	const valuesAsArray = Array.isArray(value) ? value : [[value]];
	for (const [item] of valuesAsArray) {
		if (!(item instanceof Token) && typeof item !== "string") {
			throw new Error("Unknown value in header");
		}
		const val = item instanceof Token ? item.toString() : item;
		if (val === "*") {
			return val;
		}
		if (val === "none") {
			return false;
		}
		if (val === "self") {
			allowList.add(`'${val}'`);
		} else {
			addIfOrigin(allowList, val);
		}
	}

	return allowList.size > 0 ? allowList : false;
}

function addIfOrigin(set: Set<string>, val: string) {
	try {
		const { origin } = new URL(val);
		set.add(origin);
	} catch {
		// do nothing
	}
}
