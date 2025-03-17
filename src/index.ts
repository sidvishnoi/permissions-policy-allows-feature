import { parseAllow, parseHeader } from "./lib.ts";
import type {
	AllowList,
	FeatureIdentifier,
	ParsedAllowValue,
	ParsedHeaderValue,
} from "./lib.ts";

export { parseAllow, parseHeader } from "./lib.ts";

type DefaultAllowlist = "*" | "'self'" | "'none'" | "'src'";

type ConstructorParams = {
	/** URL origin of the host page */
	origin: URL["origin"] | string;
	/**
	 * Value of Permissions-Policy header. Pass empty string if undefined. You can
	 * also pass result of {@linkcode parseHeader} if you have it handy.
	 */
	headerValue: string | NormalizedParsedValue;
	/**
	 * Use this to provide supported features and their default allowlist. By
	 * default, each feature (any string) is supported and has a default allowlist
	 * of `'self'`.
	 *
	 * We don't intend do maintain a list ourselves.
	 */
	defaultAllowlist?: Record<FeatureIdentifier, DefaultAllowlist>;
	/**
	 * Iframe details. In general, you don't want to pass this parameter, but use
	 * {@linkcode PermissionsPolicy.inherit} instead.
	 */
	frame?: {
		/**
		 * Value of allow attribute as string, or result of {@linkcode parseAllow}
		 */
		allow: string | NormalizedParsedValue;
		/** URL origin of the iframe */
		origin: URL["origin"] | string;
	};
};

export class PermissionsPolicy {
	readonly #opts: ConstructorParams;
	readonly #origin: URL["origin"];
	readonly #header: NormalizedParsedValue;
	readonly #defaultAllowList: Record<FeatureIdentifier, DefaultAllowlist>;
	readonly #frame: { allow: NormalizedParsedValue; origin: URL["origin"] } = {
		allow: new Map(),
		origin: "",
	};
	readonly #isIframePolicy: boolean;

	constructor(opts: ConstructorParams) {
		this.#opts = opts;

		this.#origin = new URL(opts.origin).origin;
		this.#header = normalizeParsedValue(
			parseHeader(opts.headerValue),
			this.#origin,
		);
		this.#defaultAllowList = opts.defaultAllowlist || {};
		if (opts.frame) {
			const frameOrigin = new URL(opts.frame.origin).origin;
			this.#frame = {
				allow: normalizeParsedValue(
					parseAllow(opts.frame.allow),
					this.#origin,
					frameOrigin,
				),
				origin: frameOrigin,
			};
		}
		this.#isIframePolicy = !!opts.frame?.origin;
	}

	/** Make a frame inherit from an existing policy (of host page) */
	inherit(
		frameInfo: NonNullable<ConstructorParams["frame"]>,
	): PermissionsPolicy {
		return new PermissionsPolicy({
			origin: this.#origin,
			headerValue: this.#header,
			defaultAllowlist: this.#defaultAllowList,
			frame: frameInfo,
		});
	}

	/**
	 * https://developer.mozilla.org/en-US/docs/Web/API/FeaturePolicy/allowsFeature
	 */
	allowsFeature(feature: string, origin?: URL["origin"]): boolean {
		const fromDefault = this.#defaultAllowList[feature];
		const fromHeader = this.#header.get(feature);
		const fromIframe = this.#frame.allow.get(feature);

		// biome-ignore lint/style/noParameterAssign: it's ok once
		origin = origin
			? new URL(origin).origin
			: this.#frame.origin || this.#origin;

		const headerAllows = this.#headerAllows(origin, fromHeader);
		const frameAllows = this.#frameAllows(origin, fromIframe);

		if (
			typeof fromHeader === "undefined" &&
			typeof fromIframe === "undefined"
		) {
			// console.log({ defaultAllows: this.#defaultAllows(fromDefault, origin) });
			return this.#defaultAllows(fromDefault, origin);
		}
		// if (typeof fromIframe === "undefined") {
		// 	return headerAllows;
		// }
		return headerAllows && frameAllows;
	}

	#defaultAllows(
		fromDefault: DefaultAllowlist,
		origin: URL["origin"],
	): boolean {
		switch (fromDefault) {
			case "'none'":
				return false;
			case "*":
				return this.#isIframePolicy
					? this.#frame.origin === this.#origin
					: true;
			case "'src'":
				return this.#frame.origin === origin;
			// biome-ignore lint/complexity/noUselessSwitchCase: safety
			case "'self'":
			default: // default allowlist is 'self'
				return this.#isIframePolicy
					? this.#frame.origin === this.#origin && this.#frame.origin === origin
					: this.#origin === origin;
		}
	}

	#headerAllows(origin: URL["origin"], fromHeader?: AllowList): boolean {
		if (typeof fromHeader === "undefined") {
			return true;
		}
		if (fromHeader === "*") {
			return true;
		}
		if (fromHeader === false) {
			return false;
		}
		return fromHeader.has(origin);
	}

	#frameAllows(origin: URL["origin"], fromIframe?: AllowList): boolean {
		if (!this.#isIframePolicy) {
			return true;
		}
		if (typeof fromIframe === "undefined") {
			if (this.#frame.origin === this.#origin) {
				return this.#frame.origin === origin;
			}
			return false;
		}
		if (fromIframe === "*") {
			return origin === this.#frame.origin; // ??? TODO
		}
		if (fromIframe === false) {
			return false;
		}

		return fromIframe.has(origin) && fromIframe.has(this.#frame.origin);
	}
}

// remove special keywords from parsed values and normalizes it.
function normalizeParsedValue<T extends ParsedAllowValue | ParsedHeaderValue>(
	parsed: T,
	selfOrigin: URL["origin"],
	srcOrigin?: URL["origin"],
): NormalizedParsedValue {
	if (parsed instanceof NormalizedParsedValue) {
		// avoid same processing over and over
		return parsed;
	}

	const result = new NormalizedParsedValue(parsed);
	for (const [k, v] of result) {
		if (v === "*" || v === false) {
			continue;
		}
		if (v.size === 0 && srcOrigin) {
			v.add(srcOrigin); // src is default for iframes
			continue;
		}

		if (v.has("'none'")) {
			result.set(k, new Set());
		}

		if (v.has("'self'")) {
			v.delete("'self'");
			v.add(selfOrigin);
		}
		if (v.has("'src'") && srcOrigin) {
			v.delete("'src'");
			v.add(srcOrigin);
		}
	}
	return result;
}

class NormalizedParsedValue
	extends Map<FeatureIdentifier, AllowList>
	implements ParsedAllowValue, ParsedHeaderValue
{
	// biome-ignore lint/complexity/noUselessConstructor: not useless
	constructor(entries: Iterable<[FeatureIdentifier, AllowList]>) {
		super(entries);
	}
}
