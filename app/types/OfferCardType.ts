import type {OfferCardFeatureType} from "~/types/OfferCardFeatureType";

export type OfferCardType = {
    nameKey: string;
    descriptionKey: string;
    monthly: string;
    yearly: string;
    features: OfferCardFeatureType[];
    highlight: boolean;
    order: number;
    isVisible: boolean;
    expanded: boolean;
}