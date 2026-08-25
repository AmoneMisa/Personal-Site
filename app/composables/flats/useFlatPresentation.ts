import type { FlatCardPresentation, FlatListing, FlatView } from "~/types/flats";
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

const semanticListingTags = new Set([
  "for sale", "sale", "long term rent", "rent", "short term rent", "daily rent", "room rent", "room only",
  "agency", "owner", "no commission", "commission",
]);

export function useFlatPresentation(options: FlatPresentationOptions) {
  const { t } = options;
  const locName = (value: string | null | undefined, kind: LocationKind = "any") =>
    locationLabel(value, options.getLocale(), kind);

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

  function hasMeaningfulTitle(value: string): boolean {
    const content = value
      .replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}\p{Emoji_Modifier}\p{Variation_Selector}\p{Join_Control}]/gu, "")
      .replace(/[^\p{L}\p{N}]+/gu, "");
    return content.length >= 3;
  }

  function displayListingTitle(listing: FlatListing): string {
    const title = listing.title.replace(/\s+/g, " ").trim();
    if (hasMeaningfulTitle(title)) return title;
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
    const rooms = normalized.match(/^(\d+)\s+rooms?$/);
    if (rooms) return t("roomsN", { n: Number(rooms[1]) });
    return locName(value, "any");
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

  function badgeData(listing: FlatListing): { values: string[]; visionLabels: string[] } {
    const values: string[] = [];
    const visionLabels: string[] = [];
    const derived = new Set((listing.vision?.derivedFields || []).map(String));
    const push = (label: string, visionField?: string) => {
      if (!label) return;
      values.push(label);
      if (visionField && derived.has(visionField)) visionLabels.push(label);
    };

    if (options.getView() !== "active" || options.getAgency() === "any") push(listing.byAgency ? t("badgeAgency") : t("badgeOwner"));
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
    if (listing.audience === "family") push(t("badgeFamily"));
    if (listing.audience === "women") push(t("badgeWomen"));
    if (listing.audience === "men") push(t("badgeMen"));

    // Facts that are normally too detailed for a compact card become useful when
    // AI vision supplied them: users can immediately see what the photos added.
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

  function presentCard(listing: FlatListing): FlatCardPresentation {
    const specification: string[] = [];
    if (listing.rooms != null) specification.push(t("roomsN", { n: listing.rooms }));
    if (listing.areaSqm != null) specification.push(`${listing.areaSqm} ${t("sqm")}`);
    if (listing.floor != null) specification.push(listing.totalFloors != null ? `${listing.floor}/${listing.totalFloors} ${t("floorAbbr")}` : `${listing.floor} ${t("floorAbbr")}`);
    const badgeResult = badgeData(listing);

    return {
      title: displayListingTitle(listing),
      price: priceLabel(listing),
      convertedPrice: convertedLabel(listing),
      specification: specification.join(" · "),
      location: [locName(listing.city, "city"), locName(listing.district, "district"), locName(listing.metro, "metro")].filter(Boolean).join(", "),
      dealLabel: cardDealLabel(listing),
      dealTone: dealTone(listing),
      badges: badgeResult.values,
      visionBadgeLabels: badgeResult.visionLabels,
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
