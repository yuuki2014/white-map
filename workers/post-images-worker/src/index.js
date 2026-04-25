/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

export default {
	async fetch(request, env, ctx) {
		console.log(getCookie(request, "media_access_grant"))
		const url = new URL(request.url);
		const match = url.pathname.match(/^\/(?:variants\/)?posts\/(\d+)\/(.+)$/);

		console.log(url)
		console.log(match)

		if (!match) {
			return new Response("Not Found", { status: 404 });
		}

		const postId = Number(match[1]);
		const objectKey = url.pathname.slice(1);

		// jwtを取得
		const token = getCookie(request, "media_access_grant");
		if (!token) {
			return new Response("Forbidden", { status: 403 });
		}

		// jwtを検証
		let payload;
		try {
			payload = await verifyJWT(token, env.MEDIA_JWT_SECRET);
		} catch (e) {
			return new Response("Forbidden", { status: 403 });
		}

		// postIdの認可チェック
		if (!Array.isArray(payload.post_ids) || !payload.post_ids.includes(postId)) {
			return new Response("Forbidden", { status: 403 });
		}

		// R2のカスタムドメインへ流す
    const upstreamUrl = new URL(request.url);
		upstreamUrl.hostname = env.MEDIA_ORIGIN_HOST;

		const upstreamRequest = new Request(upstreamUrl.toString(), {
			method: "GET",
			headers: {
				"CF-Access-Client-Id": env.CF_ACCESS_CLIENT_ID,
				"CF-Access-Client-Secret": env.CF_ACCESS_CLIENT_SECRET,
			},
		});

		const originRes = await fetch(upstreamRequest, {
			cf: {
				cacheEverything: true,
				cacheTtlByStatus: {
					"200-299": 31536000,
					"304": 31536000,
					"404": 0,
					"500-599": 0,
				},
			},
		});

		const res = new Response(originRes.body, originRes);

		if ((originRes.status >= 200 && originRes.status < 300) || originRes.status === 304) {
			res.headers.set(
				"Cache-Control",
				"public, max-age=1800, s-maxage=31536000, immutable"
			);
		} else if (originRes.status === 404) {
			res.headers.set("Cache-Control", "public, max-age=60, s-maxage=60");
		} else {
			res.headers.set("Cache-Control", "no-store");
		}

		return res;
	}
};

// jwt検証関数
async function verifyJWT(token, secret) {
	const [headerB64, payloadB64, signatureB64] = token.split("."); // tokenからヘッダー、ペイロード、署名に分割

	if (!headerB64 || !payloadB64 || !signatureB64) {
		throw new Error("Invalid JWT format");
	}

	// base64urlからUint8Arrayへ
	const encoder = new TextEncoder();
	const data = encoder.encode(`${headerB64}.${payloadB64}`);

	const signature = base64urlToUint8Array(signatureB64);

	const key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["verify"]
	);

	const valid = await crypto.subtle.verify(
		"HMAC",
		key,
		signature,
		data
	);

	if (!valid) {
		throw new Error("Invalid signature");
	}

	const payloadJson = atobUrl(payloadB64);
	const payload = JSON.parse(payloadJson);

	// expチェック
	if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
		throw new Error("Token expired");
	}

	return payload;
}

function atobUrl(str) {
	str = str.replace(/-/g, "+").replace(/_/g, "/");
	return atob(str);
}

function base64urlToUint8Array(base64url) {
	const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
	const raw = atob(base64);
	return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

function getCookie(request, name) {
	const cookie = request.headers.get("cookie");
	if (!cookie) return null;

	const match = cookie.match(new RegExp(`${name}=([^;]+)`));
	return match ? match[1] : null;
}
