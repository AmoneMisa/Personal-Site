export type ServiceType = {
    id: string;
    titleKey: string;
    descriptionKey: string;
    link: string | null;
    image: string | null;
    categoryId: string;
    order: number | 0;
    isVisible: boolean;
    createdAt: string;
}
