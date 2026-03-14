const GEOAPIFY_API_KEY      = "a14e65378c36420880182e399a9013dc" // geoapifyのAPIキー

const CATEGORY_KEYWORDS = {
  "カフェ": "catering.cafe",
  "喫茶店": "catering.cafe",
  "レストラン": "catering.restaurant",
  "居酒屋": "catering.pub",
  "バー": "catering.bar",
  "コンビニ": "commercial.convenience",
  "スーパー": "commercial.supermarket",
  "ドラッグストア": "healthcare.pharmacy",
  "薬局": "healthcare.pharmacy",
  "公園": "leisure.park",
  "ホテル": "accommodation.hotel",
  "駅": "building.transportation,public_transport.train",
  "バス停": "public_transport.bus",
  "神社": "religion.place_of_worship.shinto",
  "寺": "religion.place_of_worship.buddhist",
  "お寺": "religion.place_of_worship.buddhist",
  "史跡": "heritage",
  "城": "tourism.sights.castle",
  "観光": "tourism.sights",
  "観光名所": "tourism.sights",
  "展望台": "tourism.sights.viewpoint",
  "温泉": "leisure.spa",
  "銭湯": "leisure.spa",
  "美術館": "entertainment.museum.art",
  "博物館": "entertainment.museum",
  "本屋": "commercial.books",
  "書店": "commercial.books",
  "パン屋": "commercial.food_and_drink.bakery",
  "ベーカリー": "commercial.food_and_drink.bakery",
  "スイーツ": "commercial.food_and_drink.sweets"
};

const BRAND_CATEGORY_HINTS = [
  { keyword: "スターバックス", formalName: "スターバックス", category: "catering.cafe" },
  { keyword: "スタバ", formalName: "スターバックス", category: "catering.cafe" },
  { keyword: "starbucks", formalName: "スターバックス", category: "catering.cafe" },
  { keyword: "ドトール", formalName: "ドトール", category: "catering.cafe" },
  { keyword: "タリーズ", formalName: "タリーズ", category: "catering.cafe" },
  { keyword: "セブン", formalName: "セブン", category: "commercial.convenience" },
  { keyword: "セブンイレブン", formalName: "セブン", category: "commercial.convenience" },
  { keyword: "ファミマ", formalName: "ファミリーマート", category: "commercial.convenience" },
  { keyword: "ファミリーマート", formalName: "ファミリーマート", category: "commercial.convenience" },
  { keyword: "ローソン", formalName: "ローソン", category: "commercial.convenience" },
  { keyword: "マクドナルド", formalName: "マクドナルド", category: "catering.fast_food" },
  { keyword: "マック", formalName: "マクドナルド", category: "catering.fast_food" },
  { keyword: "マクド", formalName: "マクドナルド", category: "catering.fast_food" },
  { keyword: "すき家", formalName: "すき家", category: "catering.fast_food" }
];

// queryを正規化
function normalizeQuery(query) {
  return query.trim().replace(/\s+/g, " ");
}

// 末尾が駅で終わる場合に駅を消す
function stripStationSuffix(query) {
  return query.replace(/駅$/, "").trim();
}

// カテゴリー検索に該当するかチェック
function detectCategoryQuery(query) {
  return CATEGORY_KEYWORDS[query] || null;
}

// ブランド検索に該当するかチェック
function detectBrandMatch(query) {
  const lower = query.toLowerCase();
  for (const item of BRAND_CATEGORY_HINTS) {
    if (lower === item.keyword.toLowerCase()) {
      return item;
    }
  }
  return null;
}

// 駅検索に該当するかチェック
function isStationQuery(query) {
  return query.endsWith("駅") && query !== "駅";
}

// queryが1文字以上かチェック
function isLikelyPlaceNameQuery(query) {
  return query.length >= 1;
}

// 距離を返す
function distanceOrMax(feature) {
  return feature?.properties?.distance ?? Number.MAX_SAFE_INTEGER;
}

// featureを作る
function makeMaplibreFeature(feature) {
  const props = feature.properties || {};
  const raw = props.datasource?.raw || {};

  const categories = props.categories || [];
  const isStationLike =
    categories.includes("public_transport.train") ||
    categories.includes("building.transportation");

  const name =
    props.name ||
    raw.name ||
    props.address_line1 ||
    props.street ||
    props.city ||
    props.formatted ||
    "不明";

  const displayName = isStationLike && name && !name.endsWith("駅") ? `${name}駅` : name;

  // 距離を整形
  let distanceText = "";
  if (props.distance != null) {
    if (props.distance >= 1000) {
      distanceText = `${(props.distance / 1000).toFixed(1)}km`;
    } else {
      distanceText = `${props.distance}m`;
    }
  }

  const placeName = [displayName, distanceText, props.branch, props.suburb, props.city, props.country].filter(Boolean).join(", ") || displayName;

  return {
    type: "Feature",
    geometry: feature.geometry,
    place_name: placeName,
    text: name,
    properties: {
      ...props
    }
  };
}

// geoapifyからデータを取得
async function fetchGeoapify(url) {
  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Geoapify request failed: ${response.status}`);
  }
  return response.json();
}

export function createGeocoderApi(controller) {

  return {
    forwardGeocode: async (config) => {
      const rawQuery = config.query || "";
      const query = normalizeQuery(rawQuery); // クエリを正規化

      // 現在地を取得
      const lng = controller.currentLng;
      const lat = controller.currentLat;

      if (!query) {
        return { features: [] };
      }

      try {
        const categoryQuery = detectCategoryQuery(query);
        const brandMatch = detectBrandMatch(query);
        const stationQuery = isStationQuery(query);

        // 駅検索
        if (stationQuery) {
          console.log("駅検索が有効")
          const stationName = stripStationSuffix(query);

          const stationResults = await searchPlaces({
            query,
            category: "building.transportation,public_transport.train",
            currentLng: lng,
            currentLat: lat,
            limit: 50,
          });

          const filtered = stationResults.features
            .filter((feature) => {
              const props = feature.properties || {};
              const name = props.name || "";
              const formatted = props.formatted || "";
              return (
                name.includes(stationName) ||
                name.includes(`${stationName}駅`) ||
                formatted.includes(stationName)
              );
            })
            .sort((a, b) => {
              const an = a.properties?.name || "";
              const bn = b.properties?.name || "";
              const aExact = an === `${stationName}駅` || an === stationName;
              const bExact = bn === `${stationName}駅` || bn === stationName;

              if (aExact && !bExact) return -1;
              if (!aExact && bExact) return 1;

              return distanceOrMax(a) - distanceOrMax(b);
            });

          if (filtered.length > 0) {
            return {
              features: filtered.slice(0, 10).map(makeMaplibreFeature)
            };
          }

          // 駅検索が見つからない場合はgeocodeにフォールバック
          const fallback = await searchGeocode({
            query,
            currentLng: lng,
            currentLat: lat,
            limit: 10
          });

          const fallbackFiltered = fallback.features
            .filter((feature) => {
              const props = feature.properties || {};
              const name = props.name || "";
              const formatted = props.formatted || "";
              return (
                name.includes(stationName) ||
                name.includes(`${stationName}駅`) ||
                formatted.includes(stationName)
              );
            })
            .sort((a, b) => distanceOrMax(a) - distanceOrMax(b));

          return {
            features: fallbackFiltered.map(makeMaplibreFeature)
          };
        }

        // ジャンル検索
        if (categoryQuery) {
          const categoryResults = await searchPlaces({
            query,
            category: categoryQuery,
            currentLng: lng,
            currentLat: lat,
            radius: 50000,
            limit: 50
          });

          let filtered = categoryResults.features;

          if(isStationCategory(categoryQuery)){
            filtered = categoryResults.features.filter((feature) => {
              const props = feature.properties || {};
              const categories = props.categories || [];
              const name =
                props.name ||
                props.datasource?.raw?.name ||
                "";

              const isTrain = categories.includes("public_transport.train");
              const isNamedTransportBuilding =
                categories.includes("building.transportation") && name.trim().length > 0;

              return isTrain || isNamedTransportBuilding;
            });
          }

          return {
            features: filtered
              .sort((a, b) => distanceOrMax(a) - distanceOrMax(b))
              .slice(0, 10)
              .map(makeMaplibreFeature)
          };
        }

        // 店名検索
        if (brandMatch) {
          console.log("店名検索")
          const { category: brandCategory, formalName } = brandMatch; // 分割代入

          const brandResults = await searchPlaces({
            category: brandCategory,
            currentLng: lng,
            currentLat: lat,
            radius: 50000,
            limit: 50
          });

          const filteredBrandResults = brandResults.features
            .filter((feature) => {
              const props = feature.properties || {};
              const name = (props.name || "").toLowerCase();
              const formatted = (props.formatted || "").toLowerCase();
              const q = formalName.toLowerCase();
              return name.includes(q) || formatted.includes(q);
            })
            .sort((a, b) => distanceOrMax(a) - distanceOrMax(b));

          if (filteredBrandResults.length > 0) {
            return {
              features: filteredBrandResults.slice(0, 10).map(makeMaplibreFeature)
            };
          }
        }

        // 普通の検索
        if (isLikelyPlaceNameQuery(query)) {
          const geocodeResults = await searchGeocode({
            query,
            currentLng: lng,
            currentLat: lat,
            limit: 10
          });

          return {
            features: geocodeResults.features
              .sort((a, b) => distanceOrMax(a) - distanceOrMax(b))
              .map(makeMaplibreFeature)
          };
        }

        return { features: [] };
      } catch (error) {
        console.error("Geoapify geocoder error:", error);
        return { features: [] };
      }
    }
  }
};

function isStationCategory(category) {
  if (!category) return false;
  return category.includes("public_transport.train") || category.includes("building.transportation");
}

async function searchGeocode({
  query,
  currentLng,
  currentLat,
  limit = 10
}) {
  const url = new URL("https://api.geoapify.com/v1/geocode/search");

  url.searchParams.set("text", query);
  url.searchParams.set("lang", "ja");
  url.searchParams.set("filter", "countrycode:jp");

  if (currentLng != null && currentLat != null) {
    url.searchParams.set("bias", `proximity:${currentLng},${currentLat}`);
  }

  url.searchParams.set("limit", String(limit));
  url.searchParams.set("apiKey", GEOAPIFY_API_KEY);

  const data = await fetchGeoapify(url);

  return {
    features: (data.features || []).filter((feature) => {
      const props = feature.properties || {};
      return props.country_code === "jp" || props.country === "日本";
    })
  };
}

async function searchPlaces({
  query,
  category,
  name,
  currentLng,
  currentLat,
  radius,
  limit = 10
}) {
  const url = new URL("https://api.geoapify.com/v2/places");

  url.searchParams.set("categories", category);
  url.searchParams.set("limit", String(limit));

  console.log(url)

  // 現在地を優先順に使う
  if (currentLng != null && currentLat != null) {
    url.searchParams.set("bias", `proximity:${currentLng},${currentLat}`);
  }

  // radius があるときだけ範囲制限
  if (radius != null && currentLng != null && currentLat != null) {
    url.searchParams.set("filter", `circle:${currentLng},${currentLat},${radius}`);
  }

  url.searchParams.set("lang", "ja");
  url.searchParams.set("apiKey", GEOAPIFY_API_KEY);

  if (name && name.trim()) {
    url.searchParams.set("name", name);
  }

  const data = await fetchGeoapify(url);

  return {
    features: (data.features || []).filter((feature) => {
      const props = feature.properties || {};
      const text = `${props.name || ""} ${props.formatted || ""}`.toLowerCase();
      const q = (query || "").toLowerCase();
      const n = (name || "").toLowerCase();

      if (!name) return true;
      return text.includes(q) || text.includes(n);
    })
  };
}
