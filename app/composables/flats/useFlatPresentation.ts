import type { FlatCardPresentation, FlatListing, FlatView } from "~/types/flats";
import { hasMeaningfulHousingTitle } from "@whiteslove/parsing-lexicon/housing-title";
import { locationLabel, type LocationKind } from "~/utils/locationLabels";
import { formatRelativeDate } from "~/utils/search/relativeDate";

type Translate = (key: string, params?: Record<string, unknown>) => string;

interface FlatPresentationOptions {
  t: Translate;
  getLocale: () => string;
  getDisplayCurrency: () => string;
  getView: () => FlatView;
  getDealType: () => string;
  getRoomOnly: () => boolean;
  getAgency: () => string;
  getDistrict?: () => string;
  getMetro?: () => string;
  convert: (amount: number, from: string, to: string) => number | undefined;
}

const nearbyTranslationKeys: Record<string, string> = {
  "Bobur Park": "nearbyBoburPark",
  "Alay Bazaar": "nearbyAlayBazaar",
  Darkhan: "nearbyDarkhan",
  Novomoskovskaya: "nearbyNovomoskovskaya",
  "Farhod Bazaar": "nearbyFarhodBazaar",
  "Nizami Pedagogical University": "nearbyNizamiUniversity",
  "World Languages University": "nearbyWorldLanguagesUniversity",
  "Yangi Choshtepa": "nearbyYangiChoshtepa",
  "Sergeli Car Bazaar": "nearbySergeliCarBazaar",
  Park: "nearbyPark",
  "Bus stop": "nearbyBusStop",
  Clinic: "nearbyClinic",
  School: "nearbySchool",
  Kindergarten: "nearbyKindergarten",
  "Shopping center": "nearbyShoppingCenter",
  Mosque: "nearbyMosque",
  Dishwasher: "amenityDishwasher",
  dishwasher: "amenityDishwasher",
  "Separate rooms": "amenitySeparateRooms",
  "Washing machine": "amenityWashingMachine",
  Television: "amenityTelevision",
  "Bed linen": "amenityBedLinen",
  Towels: "amenityTowels",
};

const nearbyRuLabels: Record<string, string> = {
  "Sergili Car Market": "Сергелийский авторынок",
  "Sergili Farmers Market": "Сергелийский дехканский рынок",
  "Turon Avto": "Туран Авто",
  "Sergeli Car Bazaar": "Сергелийский авторынок",
};

const semanticListingTags = new Set([
  "for sale", "sale", "long term rent", "rent", "short term rent", "daily rent", "room rent", "room only",
  "agency", "owner", "no commission", "commission",
]);

export function useFlatPresentation(options: FlatPresentationOptions) {
  const { t } = options;
  const route = useRoute();
  const locName = (value: string | null | undefined, kind: LocationKind = "any") =>
    locationLabel(value, options.getLocale(), kind);
  const selectedDistrict = () => options.getDistrict?.() || String(route.query.district || "");
  const selectedMetro = () => options.getMetro?.() || String(route.query.metro || "");
  const hasFineGeoFilter = () => Boolean(
    selectedMetro()
    || route.query.microdistrict
    || route.query.kvartal
    || route.query.residenceComplex
    || route.query.residence_complex,
  );

  const dealLabel = (dealType: FlatListing["dealType"]) =>
    dealType === "sale" ? t("dtSale")
      : dealType === "longRent" ? t("dtLongRent")
        : dealType === "shortRent" ? t("dtShortRent")
          : "";

  const ptLabel = (propertyType: FlatListing["propertyType"]) =>
    propertyType === "house" ? t("ptHouse") : t("ptFlat");

  const conditionLabel = (condition?: FlatListing["condition"]) =>
    condition === "needs_renovation" ? t("condNeeds")
      : condition === "basic" ? t("condBasic")
        : condition === "good" ? t("condGood")
          : condition === "modern" ? t("condModern")
            : condition === "luxury" ? t("condLuxury")
              : "";

  function displayListingTitle(listing: FlatListing): string {
    const title = listing.title.replace(/\s+/g, " ").trim();
    if (hasMeaningfulHousingTitle(title)) return title;
    const parts = [
      dealLabel(listing.dealType),
      listing.rooms != null ? t("roomsN", { n: listing.rooms }) : "",
      ptLabel(listing.propertyType),
      listing.district || listing.city || "",
    ].filter(Boolean);
    return parts.join(" · ") || t("listingFallbackTitle");
  }

  function nearbyItemLabel(value: string): string {
    const key = nearbyTranslationKeys[value];
    if (key) return t(key);
    if (options.getLocale().toLowerCase().startsWith("ru") && nearbyRuLabels[value]) return nearbyRuLabels[value]!;

    const normalized = value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
    const direct: Record<string, string> = {
      "for sale": "dtSale",
      sale: "dtSale",
      "long term rent": "dtLongRent",
      rent: "dtLongRent",
      "short term rent": "cardShortRent",
      "daily rent": "cardShortRent",
      "room rent": "roomShare",
      "room only": "roomShare",
      agency: "badgeAgency",
      owner: "badgeOwner",
      "no commission": "badgeNoCommission",
      commission: "badgeCommission",
      family: "badgeFamily",
      "girls only": "badgeWomen",
      "women only": "badgeWomen",
      "men only": "badgeMen",
      deposit: "badgeDeposit",
      "new build": "badgeNew",
      "new building": "badgeNew",
      furnished: "badgeFurnished",
      "air conditioner": "badgeAC",
      balcony: "badgeBalcony",
      parking: "badgeParking",
      elevator: "badgeElevator",
      internet: "badgeInternet",
      negotiable: "badgeNegotiable",
      "pets allowed": "badgePet",
      "children allowed": "badgeChildren",
      "utilities included": "badgeUtilIncl",
      "washing machine": "amenityWashingMachine",
      dishwasher: "amenityDishwasher",
      tv: "amenityTelevision",
      television: "amenityTelevision",
    };
    const directKey = direct[normalized];
    if (directKey) return t(directKey);
    return locName(value, "any");
  }

  function audienceBadgeLabel(listing: FlatListing): string {
    const alternatives = new Set(listing.audienceAlternatives || []);
    if (alternatives.has("family") && alternatives.has("women")) {
      return options.getLocale().toLowerCase().startsWith("ru") ? "Семья или девушки" : "Family or women";
    }
    if (listing.audience === "family") return t("badgeFamily");
    if (listing.audience === "women") return t("badgeWomen");
    if (listing.audience === "men") return t("badgeMen");
    return "";
  }

  function dealTone(listing: FlatListing): FlatCardPresentation["dealTone"] {
    if (listing.dealType === "shortRent") return "short";
    if (listing.roomOnly) return "room";
    if (listing.dealType === "sale") return "sale";
    if (listing.dealType === "longRent") return "rent";
    return "";
  }

  function cardDealLabel(listing: FlatListing): string {
    const filterApplies = options.getView() === "active";
    const selectedDealType = options.getDealType();
    if (listing.dealType === "shortRent") return !filterApplies || selectedDealType !== "shortRent" ? t("cardShortRent") : "";
    if (listing.roomOnly) return !filterApplies || (!options.getRoomOnly() && selectedDealType !== "roomRent") ? t("roomShare") : "";
    if (!filterApplies || selectedDealType === "any") {
      if (listing.dealType === "longRent") return t("cardRent");
      return dealLabel(listing.dealType);
    }
    return "";
  }

  function contextualBadgeLabel(listing: FlatListing): string {
    if (options.getView() !== "active" || options.getAgency() === "any") {
      return listing.byAgency ? t("badgeAgency") : t("badgeOwner");
    }

    const rooms = listing.rooms != null ? t("roomsN", { n: listing.rooms }) : "";
    if (hasFineGeoFilter()) return rooms;

    const microdistrict = locName(listing.microdistrict || listing.kvartal, "any");
    const residenceComplex = listing.residenceComplex?.trim() || "";
    const metro = locName(listing.metro, "metro");

    if (selectedDistrict()) {
      return metro || microdistrict || residenceComplex || rooms;
    }

    return locName(listing.district, "district") || metro || microdistrict || residenceComplex || rooms;
  }

  function badgeData(listing: FlatListing): { values: string[]; visionLabels: string[] } {
    const values: string[] = [];
    const visionLabels: string[] = [];
    const derived = new Set((listing.vision?.derivedFields || []).map(String));
    const push = (label: string, visionField?: string) => {
      if (!label) return;
      values.push(label);
      if (visionField && derived.has(visionField)) visionLabels.push(label);
    };

    push(contextualBadgeLabel(listing));
    if (listing.commission === false) push(t("badgeNoCommission"));
    else if (listing.commissionPercent != null) push(t("badgeCommissionPercent", { n: listing.commissionPercent }));
    else if (listing.commission === true) push(t("badgeCommission"));
    if (listing.newBuilding) push(t("badgeNew"));
    if (listing.furnished) push(t("badgeFurnished"), "furnished");
    if (listing.airConditioner) push(t("badgeAC"), "airConditioner");
    if (listing.balcony) push(t("badgeBalcony"), "balcony");
    if (listing.parking) push(t("badgeParking"), "parking");
    if (listing.elevator) push(t("badgeElevator"), "elevator");
    if (listing.internet) push(t("badgeInternet"));
    if (listing.negotiable) push(t("badgeNegotiable"));
    if (listing.petsAllowed) push(t("badgePet"));
    if (listing.childrenAllowed) push(t("badgeChildren"));
    if (listing.communalSeparated === false) push(t("badgeUtilIncl"));
    if (listing.deposit === true) push(t("badgeDeposit"));
    push(audienceBadgeLabel(listing));

    if (derived.has("bedrooms") && listing.bedrooms != null) push(`${t("specBedrooms")}: ${listing.bedrooms}`, "bedrooms");
    if (derived.has("bathrooms") && listing.bathrooms != null) push(`${t("specBathrooms")}: ${listing.bathrooms}`, "bathrooms");
    if (derived.has("condition") && listing.condition) push(conditionLabel(listing.condition), "condition");

    const visionAmenityLabels: Record<string, string> = {
      washingMachine: t("amenityWashingMachine"),
      dishwasher: t("amenityDishwasher"),
      tv: t("amenityTelevision"),
    };
    for (const [field, label] of Object.entries(visionAmenityLabels)) {
      if (derived.has(field)) push(label, field);
    }

    for (const tag of listing.tags || []) {
      const normalized = tag.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
      if (semanticListingTags.has(normalized)) continue;
      const label = nearbyItemLabel(tag).trim();
      if (label) push(label);
    }

    const uniqueValues = [...new Set(values)];
    return {
      values: uniqueValues,
      visionLabels: [...new Set(visionLabels)].filter((label) => uniqueValues.includes(label)),
    };
  }

  function priceLabel(listing: FlatListing): string {
    return listing.price == null ? t("priceNA") : `${listing.price.toLocaleString()} ${listing.currency}`.trim();
  }

  function convertedLabel(listing: FlatListing): string | null {
    const displayCurrency = options.getDisplayCurrency();
    if (listing.price == null || !listing.currency || listing.currency.toUpperCase() === displayCurrency.toUpperCase()) return null;
    const converted = options.convert(listing.price, listing.currency, displayCurrency);
    return converted === undefined ? null : `≈ ${Math.round(converted).toLocaleString()} ${displayCurrency}`;
  }

  function goodPriceData(listing: FlatListing): Pick<FlatCardPresentation, "goodPrice" | "goodPriceMedianUsd" | "goodPriceComparableCount"> {
    return {
      goodPrice: listing.marketComparison?.goodPrice === true,
      goodPriceMedianUsd: listing.marketComparison?.medianUsd ?? null,
      goodPriceComparableCount: listing.marketComparison?.comparableCount ?? 0,
    };
  }

  function presentCard(listing: FlatListing): FlatCardPresentation {
    const specification: string[] = [];
    if (listing.rooms != null) specification.push(t("roomsN", { n: listing.rooms }));
    if (listing.areaSqm != null) specification.push(`${listing.areaSqm} ${t("sqm")}`);
    if (listing.floor != null) specification.push(listing.totalFloors != null ? `${listing.floor}/${listing.totalFloors} ${t("floorAbbr")}` : `${listing.floor} ${t("floorAbbr")}`);
    const badgeResult = badgeData(listing);
    const cardLocation = [...new Set([
      locName(listing.city, "city"),
      locName(listing.district, "district"),
    ].filter(Boolean))].join(", ");
    const priceComparison = goodPriceData(listing);

    return {
      title: displayListingTitle(listing),
      price: priceLabel(listing),
      convertedPrice: convertedLabel(listing),
      specification: specification.join(" · "),
      location: cardLocation,
      dealLabel: cardDealLabel(listing),
      dealTone: dealTone(listing),
      badges: badgeResult.values,
      visionBadgeLabels: badgeResult.visionLabels,
      ...priceComparison,
      dateLabel: formatRelativeDate(listing.createdAt, {
        today: () => t("today"),
        yesterday: () => t("yesterday"),
        daysAgo: (n) => t("daysAgo", { n }),
        monthsAgo: (n) => t("monthsAgo", { n }),
      }),
    };
  }

  return { presentCard, displayListingTitle, priceLabel, convertedLabel, nearbyItemLabel, dealLabel, ptLabel };
}
