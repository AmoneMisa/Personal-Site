export default interface TestimonialInterface {
    id: number;
    name: string;
    role: string;
    quote: string;
    avatar?: string;
    logo?: string;
    rating: number;
    order?: number;
    isVisible: boolean;
}